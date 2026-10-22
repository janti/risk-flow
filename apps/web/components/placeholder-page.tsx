"use client";

import { EmptyState, PageHeader, useT } from "@riskflow/ui";

type PlaceholderPageProps = {
  title: string;
  description: string;
};

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  const t = useT();
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <EmptyState title={t("placeholder.title")} description={t("placeholder.description")} />
    </div>
  );
}
