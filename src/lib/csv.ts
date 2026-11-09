const FORMULA_PREFIXES = new Set(["=", "+", "-", "@", "\t", "\r"]);

/**
 * Neutralizes CSV formula injection (SDD §5.7 / S6) by prefixing cells that begin
 * with '=', '+', '-', '@', tab, or CR with a single quote, then RFC-4180 quoting.
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str = String(value);
  if (str.length > 0 && FORMULA_PREFIXES.has(str[0]!)) {
    str = `'${str}`;
  }
  if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const headerLine = headers.map(escapeCsvCell).join(",");
  const bodyLines = rows.map((row) => row.map(escapeCsvCell).join(","));
  return [headerLine, ...bodyLines].join("\r\n") + "\r\n";
}
