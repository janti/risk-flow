"use client";

import { StatusBadge, useT } from "@riskflow/ui";
import Link from "next/link";
import type { RiskRecord } from "./types";

type RiskTableProps = {
  tenantSlug: string;
  risks: RiskRecord[];
};

export function RiskTable({ tenantSlug, risks }: RiskTableProps) {
  const t = useT();
  return (
    <>
      <ul className="space-y-3 md:hidden" data-testid="risk-card-list">
        {risks.map((risk) => (
          <li key={risk.id} className="rounded-lg border bg-card p-4">
            <Link
              className="block cursor-pointer font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              href={`/t/${tenantSlug}/risks/${risk.id}`}
              data-testid={`risk-card-${risk.code}`}
            >
              {risk.code} · {risk.title}
            </Link>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <StatusBadge status={risk.status} />
              <span>{risk.category.name}</span>
              <span>{risk.orgUnit.name}</span>
              <span>{risk.owner.displayName}</span>
            </div>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
        <table className="w-full min-w-[56rem] text-left text-sm" data-testid="risk-table">
          <caption className="sr-only">{t("risks.tableCaption")}</caption>
          <thead>
            <tr className="border-b">
              <th scope="col" className="px-4 py-3 font-medium">
                {t("risks.code")}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t("common.title")}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t("common.status")}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t("risks.category")}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t("risks.orgUnit")}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t("risks.owner")}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t("risks.inherent")}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t("risks.residual")}
              </th>
            </tr>
          </thead>
          <tbody>
            {risks.map((risk) => (
              <tr key={risk.id} className="border-b last:border-0 hover:bg-accent/40">
                <th scope="row" className="px-4 py-3 font-medium">
                  <Link
                    className="cursor-pointer underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    href={`/t/${tenantSlug}/risks/${risk.id}`}
                  >
                    {risk.code}
                  </Link>
                </th>
                <td className="px-4 py-3">
                  <Link
                    className="cursor-pointer underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    href={`/t/${tenantSlug}/risks/${risk.id}`}
                    data-testid={`risk-row-${risk.code}`}
                  >
                    {risk.title}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={risk.status} />
                </td>
                <td className="px-4 py-3">{risk.category.name}</td>
                <td className="px-4 py-3">{risk.orgUnit.name}</td>
                <td className="px-4 py-3">{risk.owner.displayName}</td>
                <td className="px-4 py-3">
                  {risk.latestInherent ? <StatusBadge status={risk.latestInherent.rating} /> : "—"}
                </td>
                <td className="px-4 py-3">
                  {risk.latestResidual ? <StatusBadge status={risk.latestResidual.rating} /> : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
