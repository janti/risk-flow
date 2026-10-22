import { randomUUID } from "node:crypto";
import { authorize, hasEnabledModule, type TenantAccess } from "@riskflow/auth";
import type { TenantDatabase } from "@riskflow/database";
import { z } from "zod";
import { inOrgUnitScope } from "./scope";
import { writeAudit, writeOutbox } from "./outbox";
import {
  MAX_ATTACHMENT_BYTES,
  getObject,
  mimeAllowed,
  objectKey,
  objectKeyBelongsToTenant,
  putObject,
  signObjectAccess,
  verifyObjectAccess,
} from "./storage";

export type AttachmentError =
  | "forbidden"
  | "not_found"
  | "invalid"
  | "module_disabled"
  | "expired"
  | "infected"
  | "pending_scan";

export type AttachmentRecord = {
  id: string;
  entityType: "risk";
  entityId: string;
  filename: string;
  mime: string;
  size: number;
  scanStatus: "pending" | "clean" | "infected" | "skipped";
  objectKey: string;
  uploadedAt: string | null;
  createdAt: string;
};

export const uploadIntentSchema = z.object({
  entityType: z.literal("risk"),
  entityId: z.string().uuid(),
  filename: z.string().trim().min(1).max(200),
  mime: z.string().trim().min(1).max(200),
  size: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
});

export type UploadIntentInput = z.infer<typeof uploadIntentSchema>;

const SIGNED_TTL_SECONDS = 60;

function mapAttachment(row: {
  id: string;
  entityType: string;
  entityId: string;
  filename: string;
  mime: string;
  size: number;
  scanStatus: string;
  objectKey: string;
  uploadedAt: Date | null;
  createdAt: Date;
}): AttachmentRecord {
  return {
    id: row.id,
    entityType: "risk",
    entityId: row.entityId,
    filename: row.filename,
    mime: row.mime,
    size: row.size,
    scanStatus: row.scanStatus as AttachmentRecord["scanStatus"],
    objectKey: row.objectKey,
    uploadedAt: row.uploadedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function signedContentUrl(
  origin: string,
  tenantSlug: string,
  attachmentId: string,
  method: "GET" | "PUT",
  objectKeyValue: string,
  now = new Date(),
): { url: string; expiresAt: string } {
  const expiresAtEpochSeconds = Math.floor(now.getTime() / 1000) + SIGNED_TTL_SECONDS;
  const signature = signObjectAccess(method, objectKeyValue, expiresAtEpochSeconds);
  const url = new URL(`${origin}/api/v1/tenants/${tenantSlug}/attachments/${attachmentId}/content`);
  url.searchParams.set("exp", String(expiresAtEpochSeconds));
  url.searchParams.set("sig", signature);
  return { url: url.toString(), expiresAt: new Date(expiresAtEpochSeconds * 1000).toISOString() };
}

export async function createUploadIntent(
  db: TenantDatabase,
  access: TenantAccess,
  input: UploadIntentInput,
  origin: string,
  requestId?: string,
  now = new Date(),
): Promise<{ attachment: AttachmentRecord; uploadUrl: string; expiresAt: string } | AttachmentError> {
  if (!hasEnabledModule(access, "risk-register")) {
    return "module_disabled";
  }
  if (!authorize(access, "risk:update")) {
    return "forbidden";
  }
  if (!mimeAllowed(input.mime, input.filename)) {
    return "invalid";
  }

  return db.withTenant(access.tenant.id, async (tx) => {
    const risk = await tx.risk.findFirst({ where: { id: input.entityId } });
    if (!risk || !inOrgUnitScope(access, risk.orgUnitId)) {
      return "not_found";
    }
    if (!authorize(access, "risk:update", { orgUnitId: risk.orgUnitId })) {
      return "forbidden";
    }

    const attachmentId = randomUUID();
    const key = objectKey(access.tenant.id, "risk", risk.id, attachmentId, input.filename);
    if (!objectKeyBelongsToTenant(access.tenant.id, key)) {
      return "invalid";
    }
    const attachment = await tx.attachment.create({
      data: {
        id: attachmentId,
        tenantId: access.tenant.id,
        entityType: "risk",
        entityId: risk.id,
        objectKey: key,
        filename: input.filename,
        mime: input.mime,
        size: input.size,
        scanStatus: "pending",
        uploadedByMembershipId: access.membership.id,
      },
    });
    await writeAudit(tx, {
      tenantId: access.tenant.id,
      actorUserId: access.user.id,
      action: "attachment.intent",
      entityType: "attachment",
      entityId: attachment.id,
      after: { riskId: risk.id, filename: attachment.filename, mime: attachment.mime, size: attachment.size },
      requestId,
    });
    const signed = signedContentUrl(origin, access.tenant.slug, attachment.id, "PUT", key, now);
    return { attachment: mapAttachment(attachment), uploadUrl: signed.url, expiresAt: signed.expiresAt };
  });
}

export async function listRiskAttachments(
  db: TenantDatabase,
  access: TenantAccess,
  riskId: string,
): Promise<AttachmentRecord[] | AttachmentError> {
  if (!hasEnabledModule(access, "risk-register")) {
    return "module_disabled";
  }
  if (!authorize(access, "risk:read")) {
    return "forbidden";
  }
  return db.withTenant(access.tenant.id, async (tx) => {
    const risk = await tx.risk.findFirst({ where: { id: riskId } });
    if (!risk || !inOrgUnitScope(access, risk.orgUnitId)) {
      return "not_found";
    }
    const rows = await tx.attachment.findMany({
      where: { entityType: "risk", entityId: risk.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return rows.map(mapAttachment);
  });
}

export async function putAttachmentContent(
  db: TenantDatabase,
  access: TenantAccess,
  attachmentId: string,
  body: Uint8Array,
  exp: number,
  signature: string,
  now = new Date(),
  requestId?: string,
): Promise<AttachmentRecord | AttachmentError> {
  if (!hasEnabledModule(access, "risk-register")) {
    return "module_disabled";
  }
  if (!authorize(access, "risk:update")) {
    return "forbidden";
  }
  return db.withTenant(access.tenant.id, async (tx) => {
    const attachment = await tx.attachment.findFirst({ where: { id: attachmentId } });
    if (!attachment) {
      return "not_found";
    }
    if (!objectKeyBelongsToTenant(access.tenant.id, attachment.objectKey)) {
      return "not_found";
    }
    const verified = verifyObjectAccess(
      "PUT",
      attachment.objectKey,
      exp,
      signature,
      Math.floor(now.getTime() / 1000),
    );
    if (verified === "expired") {
      return "expired";
    }
    if (verified !== "ok") {
      return "invalid";
    }
    const risk = await tx.risk.findFirst({ where: { id: attachment.entityId } });
    if (!risk || !inOrgUnitScope(access, risk.orgUnitId)) {
      return "not_found";
    }
    if (!authorize(access, "risk:update", { orgUnitId: risk.orgUnitId })) {
      return "forbidden";
    }
    if (body.byteLength !== attachment.size || body.byteLength > MAX_ATTACHMENT_BYTES) {
      return "invalid";
    }
    await putObject(attachment.objectKey, body);
    const updated = await tx.attachment.update({
      where: { id: attachment.id },
      data: { uploadedAt: now, scanStatus: "pending" },
    });
    await writeOutbox(tx, {
      tenantId: access.tenant.id,
      type: "attachment.uploaded",
      payload: { attachmentId: updated.id, riskId: risk.id },
    });
    await writeAudit(tx, {
      tenantId: access.tenant.id,
      actorUserId: access.user.id,
      action: "attachment.upload",
      entityType: "attachment",
      entityId: updated.id,
      after: { objectKey: updated.objectKey, size: updated.size },
      requestId,
    });
    return mapAttachment(updated);
  });
}

export async function createAttachmentDownloadUrl(
  db: TenantDatabase,
  access: TenantAccess,
  attachmentId: string,
  origin: string,
  now = new Date(),
): Promise<{ downloadUrl: string; expiresAt: string; attachment: AttachmentRecord } | AttachmentError> {
  if (!hasEnabledModule(access, "risk-register")) {
    return "module_disabled";
  }
  if (!authorize(access, "risk:read")) {
    return "forbidden";
  }
  return db.withTenant(access.tenant.id, async (tx) => {
    const attachment = await tx.attachment.findFirst({ where: { id: attachmentId } });
    if (!attachment || !attachment.uploadedAt) {
      return "not_found";
    }
    if (!objectKeyBelongsToTenant(access.tenant.id, attachment.objectKey)) {
      return "not_found";
    }
    const risk = await tx.risk.findFirst({ where: { id: attachment.entityId } });
    if (!risk || !inOrgUnitScope(access, risk.orgUnitId)) {
      return "not_found";
    }
    if (attachment.scanStatus === "pending") {
      return "pending_scan";
    }
    if (attachment.scanStatus === "infected") {
      return "infected";
    }
    const signed = signedContentUrl(origin, access.tenant.slug, attachment.id, "GET", attachment.objectKey, now);
    return {
      attachment: mapAttachment(attachment),
      downloadUrl: signed.url,
      expiresAt: signed.expiresAt,
    };
  });
}

export async function readAttachmentContent(
  db: TenantDatabase,
  access: TenantAccess,
  attachmentId: string,
  exp: number,
  signature: string,
  now = new Date(),
): Promise<{ body: Uint8Array; attachment: AttachmentRecord } | AttachmentError> {
  if (!hasEnabledModule(access, "risk-register")) {
    return "module_disabled";
  }
  if (!authorize(access, "risk:read")) {
    return "forbidden";
  }
  return db.withTenant(access.tenant.id, async (tx) => {
    const attachment = await tx.attachment.findFirst({ where: { id: attachmentId } });
    if (!attachment || !attachment.uploadedAt) {
      return "not_found";
    }
    if (!objectKeyBelongsToTenant(access.tenant.id, attachment.objectKey)) {
      return "not_found";
    }
    const verified = verifyObjectAccess(
      "GET",
      attachment.objectKey,
      exp,
      signature,
      Math.floor(now.getTime() / 1000),
    );
    if (verified === "expired") {
      return "expired";
    }
    if (verified !== "ok") {
      return "invalid";
    }
    const risk = await tx.risk.findFirst({ where: { id: attachment.entityId } });
    if (!risk || !inOrgUnitScope(access, risk.orgUnitId)) {
      return "not_found";
    }
    if (attachment.scanStatus === "pending") {
      return "pending_scan";
    }
    if (attachment.scanStatus === "infected") {
      return "infected";
    }
    const body = await getObject(attachment.objectKey);
    if (!body) {
      return "not_found";
    }
    return { body, attachment: mapAttachment(attachment) };
  });
}
