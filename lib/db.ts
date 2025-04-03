// IndexedDB database for storing images and their embeddings

const DB_NAME = "vector-image-search-db";
const DB_VERSION = 2; // Increased version for schema update
const STORE_NAME = "images";

// Optimized image record interface
export interface ImageRecord {
  id: string;
  dataUrl: string;
  embedding: number[];
  timestamp: string;
  metadata?: {
    dominantColors?: string[];
    brightness?: number;
    contrast?: number;
  };
  textContent?: {
    text: string;
    confidence: number;
    words: Array<{
      text: string;
      confidence: number;
    }>;
  };
}

// Database connection pooling
let dbConnection: IDBDatabase | null = null;

// Initialize the database with optimized connection handling
export function initDB(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (dbConnection) {
      resolve();
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      reject("Database error: " + (event.target as IDBOpenDBRequest).error);
    };

    request.onsuccess = (event) => {
      dbConnection = (event.target as IDBOpenDBRequest).result;

      // Handle connection closing
      dbConnection.onclose = () => {
        dbConnection = null;
      };

      // Handle version change
      dbConnection.onversionchange = () => {
        dbConnection?.close();
        dbConnection = null;
      };

      resolve();
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create an object store for images if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
  });
}

// Get database connection with automatic reconnection
async function getDBConnection(): Promise<IDBDatabase> {
  if (!dbConnection) {
    await initDB();
  }
  return dbConnection!;
}

// Store an image with optimized processing
export async function storeImage(image: ImageRecord): Promise<void> {
  // Extract additional metadata from the image
  const enhancedImage = {
    ...image,
    metadata: await extractImageMetadata(image.dataUrl),
  };

  try {
    const db = await getDBConnection();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      const addRequest = store.add(enhancedImage);

      addRequest.onsuccess = () => {
        resolve();
      };

      addRequest.onerror = (event) => {
        reject("Error storing image: " + (event.target as IDBRequest).error);
      };
    });
  } catch (error) {
    console.error("Database connection error:", error);
    throw error;
  }
}

// Extract image metadata with optimized processing
async function extractImageMetadata(dataUrl: string): Promise<any> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // Use a smaller size for faster processing
      const size = 40;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      if (!ctx) {
        resolve({});
        return;
      }

      // Draw the image at a small size
      ctx.drawImage(img, 0, 0, size, size);

      // Get pixel data
      const imageData = ctx.getImageData(0, 0, size, size);
      const pixels = imageData.data;

      // Use a more efficient color quantization approach
      const colorMap = new Map<string, number>();
      let totalBrightness = 0;
      let totalContrast = 0;

      // Process pixels in steps to reduce computation
      for (let i = 0; i < pixels.length; i += 16) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];

        // Quantize colors more aggressively
        const quantizedR = Math.round(r / 40) * 40;
        const quantizedG = Math.round(g / 40) * 40;
        const quantizedB = Math.round(b / 40) * 40;

        const colorKey = `${quantizedR},${quantizedG},${quantizedB}`;
        colorMap.set(colorKey, (colorMap.get(colorKey) || 0) + 1);

        // Calculate brightness (simple average)
        const brightness = (r + g + b) / 3;
        totalBrightness += brightness;

        // Accumulate values for contrast calculation
        totalContrast += Math.abs(brightness - 128);
      }

      // Sort colors by frequency
      const sortedColors = Array.from(colorMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([color]) => `rgb(${color})`);

      // Calculate average brightness and contrast
      const pixelCount = pixels.length / 16; // Adjusted for the step size
      const avgBrightness = totalBrightness / pixelCount;
      const avgContrast = totalContrast / pixelCount;

      // Calculate color diversity (entropy)
      const colorEntropy = calculateColorEntropy(colorMap);

      // Calculate edge density (approximation)
      const edgeDensity = calculateEdgeDensity(imageData);

      resolve({
        dominantColors: sortedColors,
        brightness: avgBrightness / 255, // Normalize to 0-1
        contrast: avgContrast / 128, // Normalize to 0-1
        colorEntropy, // Color diversity
        edgeDensity, // Edge density (approximation of detail level)
      });
    };

    img.onerror = () => {
      resolve({});
    };

    // Set a timeout to avoid hanging
    const timeout = setTimeout(() => {
      img.src = "";
      resolve({});
    }, 3000);

    img.onload = () => {
      clearTimeout(timeout);
      const size = 40;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      if (!ctx) {
        resolve({});
        return;
      }

      // Draw the image at a small size
      ctx.drawImage(img, 0, 0, size, size);

      // Get pixel data
      const imageData = ctx.getImageData(0, 0, size, size);
      const pixels = imageData.data;

      // Use a more efficient color quantization approach
      const colorMap = new Map<string, number>();
      let totalBrightness = 0;
      let totalContrast = 0;

      // Process pixels in steps to reduce computation
      for (let i = 0; i < pixels.length; i += 16) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];

        // Quantize colors more aggressively
        const quantizedR = Math.round(r / 40) * 40;
        const quantizedG = Math.round(g / 40) * 40;
        const quantizedB = Math.round(b / 40) * 40;

        const colorKey = `${quantizedR},${quantizedG},${quantizedB}`;
        colorMap.set(colorKey, (colorMap.get(colorKey) || 0) + 1);

        // Calculate brightness (simple average)
        const brightness = (r + g + b) / 3;
        totalBrightness += brightness;

        // Accumulate values for contrast calculation
        totalContrast += Math.abs(brightness - 128);
      }

      // Sort colors by frequency
      const sortedColors = Array.from(colorMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([color]) => `rgb(${color})`);

      // Calculate average brightness and contrast
      const pixelCount = pixels.length / 16; // Adjusted for the step size
      const avgBrightness = totalBrightness / pixelCount;
      const avgContrast = totalContrast / pixelCount;

      // Calculate color diversity (entropy)
      const colorEntropy = calculateColorEntropy(colorMap);

      // Calculate edge density (approximation)
      const edgeDensity = calculateEdgeDensity(imageData);

      resolve({
        dominantColors: sortedColors,
        brightness: avgBrightness / 255, // Normalize to 0-1
        contrast: avgContrast / 128, // Normalize to 0-1
        colorEntropy, // Color diversity
        edgeDensity, // Edge density (approximation of detail level)
      });
    };

    img.src = dataUrl;
  });
}

// Calculate color entropy (diversity of colors)
function calculateColorEntropy(colorMap: Map<string, number>): number {
  const totalPixels = Array.from(colorMap.values()).reduce(
    (sum, count) => sum + count,
    0
  );

  // Calculate entropy
  let entropy = 0;
  for (const count of colorMap.values()) {
    const probability = count / totalPixels;
    entropy -= probability * Math.log2(probability);
  }

  // Normalize to 0-1 range (assuming max entropy is ~5 for typical images)
  return Math.min(1, entropy / 5);
}

// Calculate edge density (approximation of detail level)
function calculateEdgeDensity(imageData: ImageData): number {
  const { width, height, data } = imageData;
  let edgeCount = 0;

  // Simple edge detection by checking adjacent pixel differences
  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      const idx = (y * width + x) * 4;

      // Check horizontal gradient
      const rDiffH = Math.abs(data[idx] - data[idx + 4]);
      const gDiffH = Math.abs(data[idx + 1] - data[idx + 5]);
      const bDiffH = Math.abs(data[idx + 2] - data[idx + 6]);

      // Check vertical gradient
      const rDiffV = Math.abs(data[idx] - data[idx + width * 4]);
      const gDiffV = Math.abs(data[idx + 1] - data[idx + width * 4 + 1]);
      const bDiffV = Math.abs(data[idx + 2] - data[idx + width * 4 + 2]);

      // Calculate gradient magnitude
      const gradientH = (rDiffH + gDiffH + bDiffH) / 3;
      const gradientV = (rDiffV + gDiffV + bDiffV) / 3;

      // If gradient is significant, count as edge
      if (gradientH > 30 || gradientV > 30) {
        edgeCount++;
      }
    }
  }

  // Normalize by the number of pixels checked
  const pixelsChecked =
    Math.floor((width - 2) / 2) * Math.floor((height - 2) / 2);
  return edgeCount / pixelsChecked;
}

// Optimized vector similarity functions
// Calculate cosine similarity between two vectors
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  // Process in chunks for better performance
  const chunkSize = 128;
  for (let i = 0; i < a.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, a.length);

    for (let j = i; j < end; j++) {
      dotProduct += a[j] * b[j];
      normA += a[j] * a[j];
      normB += b[j] * b[j];
    }
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

// Calculate Euclidean distance between two vectors
function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }

  let sum = 0;

  // Process in chunks for better performance
  const chunkSize = 128;
  for (let i = 0; i < a.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, a.length);

    for (let j = i; j < end; j++) {
      const diff = a[j] - b[j];
      sum += diff * diff;
    }
  }

  return Math.sqrt(sum);
}

// Calculate Manhattan distance between two vectors
function manhattanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }

  let sum = 0;

  // Process in chunks for better performance
  const chunkSize = 128;
  for (let i = 0; i < a.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, a.length);

    for (let j = i; j < end; j++) {
      sum += Math.abs(a[j] - b[j]);
    }
  }

  return sum;
}

// Calculate color similarity with optimized processing
function colorSimilarity(colorsA: string[], colorsB: string[]): number {
  if (!colorsA || !colorsB || colorsA.length === 0 || colorsB.length === 0) {
    return 0.5; // Neutral if no color data
  }

  // Convert RGB strings to arrays of values with caching
  const rgbCache = new Map<string, number[]>();

  const parseRgb = (rgb: string): number[] => {
    if (rgbCache.has(rgb)) {
      return rgbCache.get(rgb)!;
    }

    const match = rgb.match(/rgb$$(\d+),(\d+),(\d+)$$/);
    if (!match) return [0, 0, 0];

    const result = [
      Number.parseInt(match[1]),
      Number.parseInt(match[2]),
      Number.parseInt(match[3]),
    ];
    rgbCache.set(rgb, result);
    return result;
  };

  // Calculate similarity between two colors
  const colorDistance = (color1: string, color2: string): number => {
    const rgb1 = parseRgb(color1);
    const rgb2 = parseRgb(color2);

    // Calculate Euclidean distance in RGB space
    const rDiff = rgb1[0] - rgb2[0];
    const gDiff = rgb1[1] - rgb2[1];
    const bDiff = rgb1[2] - rgb2[2];

    return Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff) / 441.67; // Normalize by max possible distance
  };

  // Find the best matching color for each color in A
  let totalSimilarity = 0;

  // Only use top colors for comparison
  const topColorsA = colorsA.slice(0, 3);
  const topColorsB = colorsB.slice(0, 3);

  for (const colorA of topColorsA) {
    let bestMatch = 1.0; // Start with worst possible match
    for (const colorB of topColorsB) {
      const distance = colorDistance(colorA, colorB);
      bestMatch = Math.min(bestMatch, distance);
    }
    totalSimilarity += 1 - bestMatch; // Convert distance to similarity
  }

  // Normalize result
  return totalSimilarity / topColorsA.length;
}

// Calculate visual properties similarity with enhanced metrics
function visualPropertiesSimilarity(propsA: any, propsB: any): number {
  if (!propsA || !propsB) return 0.5; // Neutral if no data

  // Calculate brightness similarity (1 - normalized difference)
  const brightnessSim =
    propsA.brightness && propsB.brightness
      ? 1 - Math.abs(propsA.brightness - propsB.brightness)
      : 0.5;

  // Calculate contrast similarity
  const contrastSim =
    propsA.contrast && propsB.contrast
      ? 1 - Math.abs(propsA.contrast - propsB.contrast)
      : 0.5;

  // Calculate color entropy (diversity) similarity
  const entropySim =
    propsA.colorEntropy && propsB.colorEntropy
      ? 1 - Math.abs(propsA.colorEntropy - propsB.colorEntropy)
      : 0.5;

  // Calculate edge density (detail level) similarity
  const edgeSim =
    propsA.edgeDensity && propsB.edgeDensity
      ? 1 - Math.abs(propsA.edgeDensity - propsB.edgeDensity)
      : 0.5;

  // Combine with weights
  return (
    brightnessSim * 0.3 + contrastSim * 0.2 + entropySim * 0.25 + edgeSim * 0.25
  );
}

// Import the text similarity function
import { calculateTextSimilarity } from "./text-recognition";

// Enhanced search function with improved accuracy
export function searchImagesByEmbedding(
  embedding: number[],
  textContent?: {
    text: string;
    words: Array<{ text: string; confidence: number }>;
  }
): Promise<any[]> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await getDBConnection();
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);

      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = async () => {
        const images = getAllRequest.result as ImageRecord[];

        if (images.length === 0) {
          resolve([]);
          return;
        }

        // Extract metadata from the query image
        const queryMetadata = await extractImageMetadata(images[0].dataUrl);

        // Use a more efficient approach for calculating similarities
        const results = await calculateSimilarities(
          images,
          embedding,
          queryMetadata,
          textContent
        );

        // Sort by similarity (highest first)
        results.sort((a, b) => b.similarity - a.similarity);

        // Analyze the distribution of similarity scores
        const similarityStats = analyzeDistribution(
          results.map((r) => r.similarity)
        );

        // Determine the optimal threshold based on the distribution
        const threshold = determineOptimalThreshold(results, similarityStats);

        console.log("Similarity stats:", similarityStats);
        console.log("Determined threshold:", threshold);

        // Filter results with the improved threshold
        const filteredResults = results.filter(
          (img) => img.similarity > threshold
        );

        // Return top results (up to 15)
        resolve(filteredResults.slice(0, 15));
      };

      getAllRequest.onerror = (event) => {
        reject(
          "Error retrieving images: " + (event.target as IDBRequest).error
        );
      };
    } catch (error) {
      reject(error);
    }
  });
}

// Analyze the distribution of similarity scores
function analyzeDistribution(scores: number[]): {
  mean: number;
  stdDev: number;
  median: number;
  quartiles: [number, number, number];
  gaps: number[];
} {
  if (scores.length === 0) {
    return {
      mean: 0,
      stdDev: 0,
      median: 0,
      quartiles: [0, 0, 0],
      gaps: [],
    };
  }

  // Calculate mean
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;

  // Calculate standard deviation
  const variance =
    scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) /
    scores.length;
  const stdDev = Math.sqrt(variance);

  // Sort scores for percentile calculations
  const sortedScores = [...scores].sort((a, b) => b - a);

  // Calculate median (50th percentile)
  const median = sortedScores[Math.floor(sortedScores.length / 2)];

  // Calculate quartiles
  const q1 = sortedScores[Math.floor(sortedScores.length * 0.25)];
  const q3 = sortedScores[Math.floor(sortedScores.length * 0.75)];

  // Calculate gaps between adjacent scores
  const gaps = [];
  for (let i = 0; i < sortedScores.length - 1; i++) {
    gaps.push(sortedScores[i] - sortedScores[i + 1]);
  }

  // Sort gaps in descending order
  gaps.sort((a, b) => b - a);

  return {
    mean,
    stdDev,
    median,
    quartiles: [q1, median, q3],
    gaps: gaps.slice(0, 3), // Return top 3 gaps
  };
}

// Determine the optimal threshold based on the distribution
function determineOptimalThreshold(
  results: any[],
  stats: {
    mean: number;
    stdDev: number;
    median: number;
    quartiles: number[];
    gaps: number[];
  }
): number {
  // Base threshold - start with a reasonable value
  let threshold = 0.45;

  // If we have enough results to analyze
  if (results.length >= 3) {
    // Check if there's a significant gap in the similarity scores
    // which would indicate a natural separation between relevant and irrelevant results
    if (stats.gaps.length > 0 && stats.gaps[0] > 0.1) {
      // Find where this gap occurs
      const gapIndex = findGapIndex(
        results.map((r) => r.similarity),
        stats.gaps[0]
      );
      if (gapIndex > 0 && gapIndex < results.length - 1) {
        // Use the midpoint of the gap as threshold
        const gapMidpoint =
          (results[gapIndex].similarity + results[gapIndex + 1].similarity) / 2;
        threshold = Math.max(threshold, gapMidpoint);
      }
    }

    // If there's a clear cluster of high-similarity results
    if (stats.quartiles[0] - stats.quartiles[2] > 0.2) {
      // Use the lower quartile as threshold
      threshold = Math.max(threshold, stats.quartiles[2]);
    }

    // If the top result is significantly better than others
    if (
      results[0].similarity > 0.8 &&
      results.length > 1 &&
      results[0].similarity - results[1].similarity > 0.2
    ) {
      // Use a higher threshold to only include very similar results
      threshold = Math.max(threshold, results[0].similarity * 0.8);
    }

    // If there are text matches, adjust threshold
    const hasTextMatches = results.some((r) => r.metrics?.text > 0.5);
    if (hasTextMatches) {
      // Lower the threshold slightly to include more potential text matches
      threshold = Math.max(0.4, threshold * 0.9);
    }
  }

  // Ensure threshold is reasonable
  return Math.min(Math.max(0.4, threshold), 0.85);
}

// Find the index where a specific gap occurs
function findGapIndex(scores: number[], targetGap: number): number {
  for (let i = 0; i < scores.length - 1; i++) {
    if (Math.abs(scores[i] - scores[i + 1] - targetGap) < 0.001) {
      return i;
    }
  }
  return -1;
}

// Improve the similarity calculation function
async function calculateSimilarities(
  images: ImageRecord[],
  embedding: number[],
  queryMetadata: any,
  textContent?: {
    text: string;
    words: Array<{ text: string; confidence: number }>;
  }
): Promise<any[]> {
  // Process in batches to avoid blocking the UI
  const BATCH_SIZE = 20;
  const results: any[] = [];

  for (let i = 0; i < images.length; i += BATCH_SIZE) {
    const batch = images.slice(i, i + BATCH_SIZE);

    // Process each batch with a small delay to keep UI responsive
    const batchResults = await new Promise<any[]>((resolve) => {
      setTimeout(() => {
        const processed = batch.map((image) => {
          // 1. Vector similarity metrics
          const cosSim = cosineSimilarity(embedding, image.embedding);

          // 2. Euclidean distance (normalized to 0-1 range)
          const euclideanDist = euclideanDistance(embedding, image.embedding);
          const maxPossibleDist = Math.sqrt(2); // Max possible distance for normalized vectors
          const euclideanSim = 1 - euclideanDist / maxPossibleDist;

          // 3. Manhattan distance (normalized)
          const manhattanDist = manhattanDistance(embedding, image.embedding);
          const manhattanSim = 1 - manhattanDist / (2 * embedding.length);

          // 4. Visual properties similarity
          const colorSim = image.metadata?.dominantColors
            ? colorSimilarity(
                queryMetadata.dominantColors,
                image.metadata.dominantColors
              )
            : 0.5;

          const visualPropsSim = visualPropertiesSimilarity(
            queryMetadata,
            image.metadata
          );

          // 5. Text similarity (if available)
          let textSim = 0;
          if (textContent?.text && image.textContent?.text) {
            textSim = calculateTextSimilarity(textContent, image.textContent);
          }

          // Determine if this is a text-heavy comparison
          const hasSignificantText =
            textContent?.words?.length > 3 &&
            image.textContent?.words?.length > 3 &&
            textSim > 0.2; // Only consider significant if there's some match

          // Analyze the type of image to determine optimal weights
          const imageCharacteristics = analyzeImageCharacteristics(
            image,
            queryMetadata
          );

          // Get adaptive weights based on image characteristics
          const weights = getAdaptiveWeights(
            imageCharacteristics,
            hasSignificantText,
            textSim,
            cosSim,
            euclideanSim,
            colorSim
          );

          // Apply a penalty for very low similarity in any major metric
          // This helps filter out false positives
          let penaltyFactor = 1.0;

          // If vector similarity is very low but other metrics are high, apply a penalty
          if (cosSim < 0.4 && euclideanSim < 0.4) {
            penaltyFactor *= 0.8;
          }

          // If color similarity is very low, apply a penalty
          if (colorSim < 0.3) {
            penaltyFactor *= 0.9;
          }

          // If text is present but similarity is very low, apply a penalty
          if (hasSignificantText && textSim < 0.2) {
            penaltyFactor *= 0.85;
          }

          // Combine similarities with weights and apply penalty
          const combinedSim =
            (cosSim * weights.cosine +
              euclideanSim * weights.euclidean +
              manhattanSim * weights.manhattan +
              colorSim * weights.color +
              visualPropsSim * weights.visualProps +
              textSim * weights.text) *
            penaltyFactor;

          return {
            ...image,
            similarity: combinedSim,
            metrics: {
              cosine: cosSim,
              euclidean: euclideanSim,
              manhattan: manhattanSim,
              color: colorSim,
              visualProps: visualPropsSim,
              text: textSim,
            },
            hasSignificantText,
            characteristics: imageCharacteristics,
          };
        });

        resolve(processed);
      }, 0); // Minimal delay to allow UI updates
    });

    results.push(...batchResults);
  }

  return results;
}

// Analyze image characteristics to determine optimal comparison strategy
function analyzeImageCharacteristics(
  image: ImageRecord,
  queryMetadata: any
): {
  isTextHeavy: boolean;
  isColorful: boolean;
  isHighContrast: boolean;
  isDetailed: boolean;
} {
  // Determine if image is text-heavy
  const isTextHeavy =
    image.textContent?.text &&
    image.textContent?.words?.length > 5 &&
    image.textContent.confidence > 0.6;

  // Determine if image is colorful
  const isColorful = image.metadata?.colorEntropy
    ? image.metadata.colorEntropy > 0.7
    : false;

  // Determine if image has high contrast
  const isHighContrast = image.metadata?.contrast
    ? image.metadata.contrast > 0.6
    : false;

  // Determine if image has lots of details
  const isDetailed = image.metadata?.edgeDensity
    ? image.metadata.edgeDensity > 0.5
    : false;

  return {
    isTextHeavy,
    isColorful,
    isHighContrast,
    isDetailed,
  };
}

// Get adaptive weights based on image characteristics
function getAdaptiveWeights(
  characteristics: {
    isTextHeavy: boolean;
    isColorful: boolean;
    isHighContrast: boolean;
    isDetailed: boolean;
  },
  hasSignificantText: boolean,
  textSim: number,
  cosSim: number,
  euclideanSim: number,
  colorSim: number
): {
  cosine: number;
  euclidean: number;
  manhattan: number;
  color: number;
  visualProps: number;
  text: number;
} {
  // Base weights
  let weights = {
    cosine: 0.3,
    euclidean: 0.25,
    manhattan: 0.15,
    color: 0.2,
    visualProps: 0.05,
    text: 0.05,
  };

  // Adjust weights based on image characteristics
  if (characteristics.isTextHeavy || hasSignificantText) {
    // For text-heavy images, increase text weight
    const textWeight = 0.2 + textSim * 0.3; // 0.2 to 0.5 based on match quality

    weights = {
      cosine: 0.25 - textWeight * 0.1,
      euclidean: 0.2 - textWeight * 0.05,
      manhattan: 0.1,
      color: 0.15,
      visualProps: 0.05,
      text: textWeight, // Dynamic weight based on text match quality
    };
  }

  if (characteristics.isColorful) {
    // For colorful images, increase color weight
    weights.color = Math.min(0.3, weights.color * 1.5);
    weights.cosine -= 0.05;
  }

  if (characteristics.isDetailed) {
    // For detailed images, increase vector similarity weights
    weights.cosine = Math.min(0.35, weights.cosine * 1.2);
    weights.euclidean = Math.min(0.3, weights.euclidean * 1.2);
    weights.color -= 0.05;
  }

  // Adjust weights based on similarity scores
  if (cosSim > 0.8) {
    // If cosine similarity is very high, increase its weight
    weights.cosine = Math.min(0.4, weights.cosine * 1.2);
  }

  if (colorSim > 0.8) {
    // If color similarity is very high, increase its weight
    weights.color = Math.min(0.3, weights.color * 1.2);
  }

  // Normalize weights to ensure they sum to 1
  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);

  return {
    cosine: weights.cosine / totalWeight,
    euclidean: weights.euclidean / totalWeight,
    manhattan: weights.manhattan / totalWeight,
    color: weights.color / totalWeight,
    visualProps: weights.visualProps / totalWeight,
    text: weights.text / totalWeight,
  };
}

// Get all images with optimized retrieval
export async function getAllImages(): Promise<ImageRecord[]> {
  try {
    const db = await getDBConnection();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);

      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = () => {
        resolve(getAllRequest.result as ImageRecord[]);
      };

      getAllRequest.onerror = (event) => {
        reject(
          "Error retrieving images: " + (event.target as IDBRequest).error
        );
      };
    });
  } catch (error) {
    console.error("Database connection error:", error);
    throw error;
  }
}

// Delete a specific image by ID
export async function deleteImage(id: string): Promise<void> {
  try {
    const db = await getDBConnection();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      const deleteRequest = store.delete(id);

      deleteRequest.onsuccess = () => {
        resolve();
      };

      deleteRequest.onerror = (event) => {
        reject("Error deleting image: " + (event.target as IDBRequest).error);
      };
    });
  } catch (error) {
    console.error("Database connection error:", error);
    throw error;
  }
}

// Clear all images from the database
export async function clearAllImages(): Promise<void> {
  try {
    const db = await getDBConnection();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      const clearRequest = store.clear();

      clearRequest.onsuccess = () => {
        resolve();
      };

      clearRequest.onerror = (event) => {
        reject("Error clearing images: " + (event.target as IDBRequest).error);
      };
    });
  } catch (error) {
    console.error("Database connection error:", error);
    throw error;
  }
}

// Close database connection when app is unloaded
export function closeDB(): void {
  if (dbConnection) {
    dbConnection.close();
    dbConnection = null;
  }
}
