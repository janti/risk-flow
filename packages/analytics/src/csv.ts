const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function csvCell(value: string | number | null | undefined): string {
  const raw = value === null || value === undefined ? "" : String(value);
  let escaped = raw.replaceAll('"', '""');
  if (FORMULA_PREFIX.test(escaped)) {
    escaped = `'${escaped}`;
  }
  if (/[",\n\r]/.test(escaped) || escaped.startsWith("'")) {
    return `"${escaped}"`;
  }
  return escaped;
}

export function toCsv(headers: readonly string[], rows: readonly (readonly (string | number | null | undefined)[])[]): string {
  const lines = [
    headers.map((header) => csvCell(header)).join(","),
    ...rows.map((row) => row.map((cell) => csvCell(cell)).join(",")),
  ];
  return `${lines.join("\r\n")}\r\n`;
}
