import { describe, expect, it } from "vitest";
import { calculateScore } from "./scoring";

type ScoreResults = Parameters<typeof calculateScore>[0];

function pintOnly(
  beer: { x: number; y: number; width: number; height: number },
  g: { x: number; y: number; width: number; height: number },
  size = 100,
): ScoreResults {
  return {
    "split results": [
      {
        predictions: {
          predictions: [],
          image: { width: size, height: size },
        },
      },
    ],
    "pint results": {
      predictions: {
        predictions: [
          {
            class: "beer",
            ...beer,
            confidence: 0.9,
          },
          {
            class: "G",
            ...g,
            confidence: 0.9,
          },
        ],
        image: { width: size, height: size },
      },
    },
  };
}

describe("calculateScore", () => {
  it("uses non-split path when no split line", () => {
    // Beer foam line (top of beer box) aligned with vertical center of the G → high score.
    const aligned = pintOnly(
      { x: 50, y: 60, width: 40, height: 20 },
      { x: 50, y: 50, width: 20, height: 20 },
    );
    const score = calculateScore(aligned);
    expect(score).toBeGreaterThan(4.5);
    expect(score).toBeLessThanOrEqual(5);
  });

  it("returns lower score when beer top is far from G center", () => {
    const misaligned = pintOnly(
      { x: 50, y: 20, width: 40, height: 50 },
      { x: 50, y: 85, width: 20, height: 24 },
    );
    const score = calculateScore(misaligned);
    expect(score).toBeLessThan(3);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});
