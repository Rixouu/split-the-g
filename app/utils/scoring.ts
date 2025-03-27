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

function normalizeCoordinates(pred: Prediction, imgDims: ImageDimensions) {
  return {
    x: pred.x / imgDims.width,
    y: pred.y / imgDims.height,
    width: pred.width / imgDims.width,
    height: pred.height / imgDims.height,
  };
}

// New scoring function for standard API response
export function calculateScoreFromPredictions(predictions: any[]): number {
  // Find G class prediction (or any containing G)
  const gPrediction = predictions.find(p => 
    p.class.toLowerCase() === 'g' || 
    p.class.toLowerCase().includes('guinness')
  );
  
  // Find glass or pint predictions
  const glassPrediction = predictions.find(p => 
    p.class.toLowerCase() === 'glass' || 
    p.class.toLowerCase().includes('pint')
  );
  
  // Calculate base score from G detection
  let score = 0;
  
  if (gPrediction) {
    // G was detected - start with confidence-based score
    // Scale confidence (0-1) to a 2-5 score range
    const confidenceScore = 2 + (3 * gPrediction.confidence);
    
    // Calculate position-based bonus:
    // - If G is in middle third of image vertically, add bonus
    const yCenter = gPrediction.y / gPrediction.height;
    const idealPosition = 0.5; // center of image
    const positionDifference = Math.abs(yCenter - idealPosition);
    
    // Adjust score based on position - closer to center is better
    let positionFactor = 1.0;
    if (positionDifference < 0.1) {
      // Very close to center - full score
      positionFactor = 1.0;
    } else if (positionDifference < 0.2) {
      // Somewhat off center - slight reduction
      positionFactor = 0.9;
    } else {
      // Far from center - larger reduction
      positionFactor = 0.8;
    }
    
    score = confidenceScore * positionFactor;
    
    // Bonus for having both G and glass in same image
    if (glassPrediction) {
      score *= 1.05; // 5% bonus
    }
  } else if (glassPrediction) {
    // No G but glass was detected - lower score based on glass confidence
    score = 1.5 + (glassPrediction.confidence * 1.5);
  } else if (predictions.length > 0) {
    // No G or glass, but something was detected
    // Use highest confidence prediction as fallback
    const highestConfPrediction = predictions.reduce((prev, current) => 
      (prev.confidence > current.confidence) ? prev : current
    );
    score = 1.0 + (highestConfPrediction.confidence * 1.5);
  } else {
    // Nothing detected - minimum score
    score = 1.0;
  }
  
  // Round to 2 decimal places for clean display
  return Math.round(score * 100) / 100;
}

// Legacy functions below for compatibility
function calculateSplitScore(splitResults: any): number {
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

function calculateNonSplitScore(pintResults: any): number {
  const predictions = pintResults?.predictions?.predictions || [];
  const imgDims = pintResults?.predictions?.image;
  const beer = predictions.find(p => p.class === 'beer');
  const g = predictions.find(p => p.class === 'G');
  
  if (!beer || !g) {
    return 0; 
  }

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

export function calculateScore(results: any): number {
  // Check for split first
  const splitScore = calculateSplitScore(results["split results"][0]);
  
  if (splitScore > 0) {
    return splitScore;
  }
  
  // If no split, calculate based on beer level to G center
  return calculateNonSplitScore(results["pint results"]);
} 