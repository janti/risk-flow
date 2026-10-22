const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type DateWindow = {
  from: Date;
  to: Date;
  fromDate: string;
  toDate: string;
};

export function isIsoDate(value: string): boolean {
  return ISO_DATE.test(value);
}

export function utcStart(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

export function utcEnd(isoDate: string): Date {
  return new Date(`${isoDate}T23:59:59.999Z`);
}

export function formatIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function monthKey(value: Date): string {
  return value.toISOString().slice(0, 7);
}

export function defaultAnalyticsWindow(now = new Date()): { fromDate: string; toDate: string } {
  const toDate = formatIsoDate(now);
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  return { fromDate: formatIsoDate(from), toDate };
}

export function resolveAnalyticsWindow(input: { from?: string; to?: string }, now = new Date()): DateWindow | "invalid" {
  const defaults = defaultAnalyticsWindow(now);
  const fromDate = input.from ?? defaults.fromDate;
  const toDate = input.to ?? defaults.toDate;
  if (!isIsoDate(fromDate) || !isIsoDate(toDate) || fromDate > toDate) {
    return "invalid";
  }
  const from = utcStart(fromDate);
  const to = utcEnd(toDate);
  const maxMs = 5 * 366 * 24 * 60 * 60 * 1000;
  if (to.getTime() - from.getTime() > maxMs) {
    return "invalid";
  }
  return { from, to, fromDate, toDate };
}

export function monthRange(from: Date, to: Date): string[] {
  const months: string[] = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  while (cursor.getTime() <= end.getTime()) {
    months.push(monthKey(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}
