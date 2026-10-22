import { describe, expect, it } from "vitest";
import { buildSimplePdf } from "./pdf";

describe("simple pdf summary", () => {
  it("emits a parseable PDF with replaced non-ascii characters", () => {
    const pdf = buildSimplePdf("RiskFlow summary", ["R-001  Toimittaja  open"]);
    const text = Buffer.from(pdf).toString("latin1");
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("RiskFlow summary");
    expect(text).toContain("R-001  Toimittaja  open".replace(/[^\x20-\x7E]/g, "?"));
    expect(text).toContain("%%EOF");
  });
});
