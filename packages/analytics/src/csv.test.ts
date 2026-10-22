import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csv export escaping", () => {
  it("quotes commas and doubles quotes", () => {
    expect(csvCell('Acme, "Ops"')).toBe('"Acme, ""Ops"""');
  });

  it("neutralizes formula injection prefixes", () => {
    expect(csvCell("=CMD()")).toBe('"\'=CMD()"');
    expect(csvCell("+1+1")).toBe('"\'+1+1"');
    expect(csvCell("-2")).toBe('"\'-2"');
    expect(csvCell("@SUM(A1)")).toBe('"\'@SUM(A1)"');
  });

  it("joins rows with CRLF", () => {
    expect(toCsv(["a", "b"], [["1", "2"]])).toBe("a,b\r\n1,2\r\n");
  });
});
