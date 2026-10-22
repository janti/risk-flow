import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, isAppLocale, parseLocale } from "./i18n";
import { en, fi, sv, t, translateError } from "./messages";

describe("i18n", () => {
  it("defaults unknown values to Finnish", () => {
    expect(parseLocale("de")).toBe(DEFAULT_LOCALE);
    expect(isAppLocale("sv")).toBe(true);
    expect(isAppLocale("no")).toBe(false);
  });

  it("covers the same keys in every locale", () => {
    expect(Object.keys(sv).sort()).toEqual(Object.keys(fi).sort());
    expect(Object.keys(en).sort()).toEqual(Object.keys(fi).sort());
  });

  it("interpolates variables", () => {
    expect(t("en", "home.welcome", { name: "Ada" })).toBe("Welcome, Ada");
    expect(t("sv", "nav.risks")).toBe("Risker");
  });

  it("maps known API error codes", () => {
    expect(translateError("en", "module_disabled", "fallback")).toBe("The module is not enabled.");
    expect(translateError("fi", "rate_limited", "Varalla")).toBe(
      "Liian monta pyyntöä. Odota hetki ja yritä uudelleen.",
    );
    expect(translateError("fi", "unknown_code", "Varalla")).toBe("Varalla");
  });
});
