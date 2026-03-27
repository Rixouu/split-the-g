interface Prediction {
  width: number;
  height: number;
  x: number;
  y: number;
  confidence: number;
  class: string;
}

interface ImageDimensions {
  width: number;
  height: number;
}

interface PredictionBlock {
  predictions: Prediction[];
  image: ImageDimensions;
}

interface SplitResults {
  predictions: PredictionBlock;
}

interface ScoreResults {
  "split results": SplitResults[];
  "pint results": {
    predictions: PredictionBlock;
  };
}

function normalizeCoordinates(pred: Prediction, imgDims: ImageDimensions) {
  return {
    x: pred.x / imgDims.width,
    y: pred.y / imgDims.height,
    width: pred.width / imgDims.width,
    height: pred.height / imgDims.height,
  };
}

function calculateSplitScore(splitResults: SplitResults | undefined): number {
  if (!splitResults?.predictions?.predictions?.[0]) {
    return 0; // No split detected
  }
  const split = splitResults.predictions.predictions[0];
  const imgDims = splitResults.predictions.image;
  const normalizedSplit = normalizeCoordinates(split, imgDims);
  const splitTopY = normalizedSplit.y - (normalizedSplit.height / 2);
  const distanceFromCenter = Math.abs(splitTopY - 0.5);
  const normalizedDistance = Math.min(distanceFromCenter / 0.5, 1);
  return 2.5 + (2.5 * (1 - normalizedDistance));
}

function calculateNonSplitScore(
  pintResults: ScoreResults["pint results"] | undefined,
): number {
  const predictions = pintResults?.predictions?.predictions || [];
  const imgDims = pintResults?.predictions?.image;
  const beer = predictions.find((p: Prediction) => p.class === "beer");
  const g = predictions.find((p: Prediction) => p.class === "G");
  
  if (!beer || !g) {
    return 0;
  }

  if (!imgDims) return 0;

  const normalizedBeer = normalizeCoordinates(beer, imgDims);
  const normalizedG = normalizeCoordinates(g, imgDims);
  const beerTopY = normalizedBeer.y - (normalizedBeer.height / 2);
  const gCenterY = normalizedG.y;
  const distanceFromCenter = Math.abs(beerTopY - gCenterY);
  const maxDistance = 0.5;
  const normalizedDistance = Math.min(distanceFromCenter / maxDistance, 1);
  const decayFactor = Math.pow(1 - normalizedDistance, 2);
  return 2.5 * decayFactor;
}

export function calculateScore(results: ScoreResults): number {
  // Check for split first
  const splitScore = calculateSplitScore(results["split results"][0]);

  if (splitScore > 0) {
    return splitScore;
  }

  // If no split, calculate based on beer level to G center
  return calculateNonSplitScore(results["pint results"]);
}