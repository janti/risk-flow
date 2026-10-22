import { Buffer } from "node:buffer";
import { authorize, hasEnabledModule, type TenantAccess } from "@riskflow/auth";
import type { TenantDatabase } from "@riskflow/database";
import { listRisks, type RiskListQuery } from "@riskflow/risk-engine";

function pdfEscape(value: string): string {
  return value
    .replace(/[^\x20-\x7E]/g, "?")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

export function buildSimplePdf(title: string, lines: string[]): Uint8Array {
  const contentLines = [
    "BT",
    "/F1 14 Tf",
    "50 780 Td",
    `(${pdfEscape(title)}) Tj`,
    "/F1 9 Tf",
    "0 -22 Td",
  ];
  for (const [index, line] of lines.entries()) {
    if (index > 0) {
      contentLines.push("0 -12 Td");
    }
    contentLines.push(`(${pdfEscape(line)}) Tj`);
  }
  contentLines.push("ET");
  const stream = contentLines.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let offset = 0;
  const xref: number[] = [];
  const chunks: string[] = ["%PDF-1.4\n"];
  offset = Buffer.byteLength(chunks[0]!, "utf8");
  objects.forEach((object, index) => {
    xref.push(offset);
    const body = `${index + 1} 0 obj\n${object}\nendobj\n`;
    chunks.push(body);
    offset += Buffer.byteLength(body, "utf8");
  });
  const xrefStart = offset;
  const xrefTable = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...xref.map((value) => `${String(value).padStart(10, "0")} 00000 n `),
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(xrefStart),
    "%%EOF",
  ].join("\n");
  chunks.push(xrefTable);
  return Buffer.from(chunks.join(""), "utf8");
}

export async function exportRisksPdf(
  db: TenantDatabase,
  access: TenantAccess,
  query: Omit<RiskListQuery, "cursor" | "limit"> & { limit?: number },
): Promise<Uint8Array | "forbidden" | "module_disabled"> {
  if (!hasEnabledModule(access, "risk-register")) {
    return "module_disabled";
  }
  if (!authorize(access, "risk:read")) {
    return "forbidden";
  }

  const lines: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await listRisks(db, access, {
      ...query,
      cursor,
      limit: 100,
      sort: query.sort ?? "createdAt",
    });
    if (page === "forbidden" || page === "module_disabled") {
      return page;
    }
    for (const risk of page.items) {
      lines.push(
        `${risk.code}  ${risk.title}  ${risk.status}  ${risk.category.code}  inh:${risk.latestInherent?.score ?? "-"}  res:${risk.latestResidual?.score ?? "-"}`,
      );
    }
    cursor = page.nextCursor ?? undefined;
  } while (cursor);

  return buildSimplePdf(`RiskFlow ${access.tenant.slug} risk summary`, lines.slice(0, 50));
}
