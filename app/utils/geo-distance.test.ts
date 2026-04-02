import { describe, expect, it } from "vitest";
import { haversineDistanceMeters } from "./geo-distance";

describe("haversineDistanceMeters", () => {
  it("is ~0 for identical points", () => {
    const p = { lat: 13.7563, lng: 100.5018 };
    expect(haversineDistanceMeters(p, p)).toBeLessThan(1);
  });

  it("matches known short distance order of magnitude (Bangkok centre to nearby)", () => {
    const a = { lat: 13.7563, lng: 100.5018 };
    const b = { lat: 13.7663, lng: 100.5118 };
    const d = haversineDistanceMeters(a, b);
    expect(d).toBeGreaterThan(1000);
    expect(d).toBeLessThan(3000);
  });
});
