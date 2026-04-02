import { describe, expect, it } from "vitest";
import { getCountryFlag } from "./leaderboard";

describe("getCountryFlag", () => {
  it("returns empty for empty code", () => {
    expect(getCountryFlag("")).toBe("");
  });

  it("returns regional-indicator flag for TH", () => {
    expect(getCountryFlag("TH")).toBe("🇹🇭");
  });

  it("is case-insensitive", () => {
    expect(getCountryFlag("gb")).toBe("🇬🇧");
  });
});
