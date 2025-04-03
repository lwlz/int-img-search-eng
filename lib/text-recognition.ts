import { createWorker, type Worker } from "tesseract.js";

// Cache for OCR workers to avoid recreating them
let ocrWorker: Worker | null = null;
let isInitializing = false;
let initPromise: Promise<void> | null = null;

// Initialize the OCR worker with optimized settings
export async function initOCR(): Promise<void> {
  // Prevent multiple simultaneous initializations
  if (isInitializing) {
    return initPromise!;
  }

  if (!ocrWorker) {
    isInitializing = true;

    initPromise = (async () => {
      try {
        // Create a worker with optimized settings for better text recognition
        ocrWorker = await createWorker("eng", {
          // Enhanced OCR settings for better text recognition
          engineOptions: {
            tessedit_char_whitelist:
              "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,;:!?@#$%&*()-_+=[]{}|<>/\\'\"`~ ", // Allow common characters
            tessedit_pageseg_mode: "3", // Fully automatic page segmentation, but no OSD (more accurate for images)
            tessedit_ocr_engine_mode: "2", // Legacy + LSTM mode for better accuracy
            tessjs_create_hocr: "0", // Disable HOCR output for speed
            tessjs_create_tsv: "0", // Disable TSV output for speed
            textord_heavy_nr: "1", // Enable noise removal
            textord_min_linesize: "2.5", // Minimum line size to help with small text
          },
        });

        console.log("OCR worker initialized successfully");
      } catch (error) {
        console.error("Failed to initialize OCR worker:", error);
        throw new Error("OCR initialization failed");
      } finally {
        isInitializing = false;
      }
    })();

    return initPromise;
  }
}

// Cache for text extraction results to avoid redundant processing
const textExtractionCache = new Map<
  string,
  {
    text: string;
    confidence: number;
    words: Array<{ text: string; confidence: number }>;
    timestamp: number;
  }
>();

// Maximum cache size to prevent memory issues
const MAX_CACHE_SIZE = 100;
const CACHE_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

// Enhanced image preprocessing for better text recognition
async function preprocessImageForOCR(imageDataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // Create a canvas for image processing
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      if (!ctx) {
        resolve(imageDataUrl); // Return original if canvas not supported
        return;
      }

      // Set canvas dimensions
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw the original image
      ctx.drawImage(img, 0, 0);

      // Get image data for processing
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Calculate average brightness
      let totalBrightness = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        totalBrightness += (r + g + b) / 3;
      }
      const avgBrightness = totalBrightness / (data.length / 4);

      // Determine if image is dark or light
      const isDark = avgBrightness < 128;

      // Apply appropriate processing based on image characteristics
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Calculate grayscale value
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;

        // Apply adaptive threshold for better text contrast
        if (isDark) {
          // For dark images, brighten text
          const threshold = avgBrightness * 0.7;
          const value = gray > threshold ? 255 : 0;
          data[i] = data[i + 1] = data[i + 2] = value;
        } else {
          // For light images, darken text
          const threshold = avgBrightness * 1.2;
          const value = gray < threshold ? 0 : 255;
          data[i] = data[i + 1] = data[i + 2] = value;
        }
      }

      // Put processed image data back to canvas
      ctx.putImageData(imageData, 0, 0);

      // Return processed image as data URL
      resolve(canvas.toDataURL("image/jpeg", 0.95));
    };

    img.onerror = () => {
      resolve(imageDataUrl); // Return original on error
    };

    img.src = imageDataUrl;
  });
}

// Extract text from an image with enhanced processing
export async function extractTextFromImage(
  imageDataUrl: string,
  options: {
    quick?: boolean; // Quick mode for UI preview vs. full mode for storage
    forceRefresh?: boolean; // Force refresh the cache
    enhanceImage?: boolean; // Apply image enhancement for better text recognition
  } = {}
): Promise<{
  text: string;
  confidence: number;
  words: Array<{ text: string; confidence: number }>;
  language?: string;
}> {
  // Generate a cache key from the image data
  const cacheKey = imageDataUrl.substring(0, 100) + imageDataUrl.length;

  // Check cache first unless force refresh is requested
  if (!options.forceRefresh && textExtractionCache.has(cacheKey)) {
    const cached = textExtractionCache.get(cacheKey)!;
    // Check if cache is still valid
    if (Date.now() - cached.timestamp < CACHE_EXPIRY_MS) {
      return {
        text: cached.text,
        confidence: cached.confidence,
        words: cached.words,
      };
    }
  }

  if (!ocrWorker) {
    try {
      await initOCR();
    } catch (error) {
      console.error("OCR not initialized:", error);
      return { text: "", confidence: 0, words: [] };
    }
  }

  try {
    // Preprocess image for better text recognition if requested
    const processedImageUrl =
      options.enhanceImage !== false
        ? await preprocessImageForOCR(imageDataUrl)
        : imageDataUrl;

    // Process the image with OCR
    const result = await ocrWorker!.recognize(processedImageUrl);

    // Extract words with confidence scores
    const words = result.data.words
      ?.filter((word) => word.confidence > 40) // Lower threshold to catch more words
      ?.map((word) => ({
        text: normalizeText(word.text),
        confidence: word.confidence / 100, // Normalize to 0-1
      }));

    // Filter out low confidence words and sort by confidence
    const filteredWords = words
      ?.filter((word) => word.confidence > 0.5 && word.text.length > 1)
      ?.sort((a, b) => b.confidence - a.confidence);

    // Normalize and clean the extracted text
    const normalizedText = normalizeText(result.data.text);

    const processedResult = {
      text: normalizedText,
      confidence: result.data.confidence / 100, // Normalize to 0-1
      words: filteredWords,
      language: result.data.language || "eng",
    };

    // Cache the result
    if (textExtractionCache.size >= MAX_CACHE_SIZE) {
      // Remove oldest entry if cache is full
      const oldestKey = textExtractionCache.keys().next().value;
      textExtractionCache.delete(oldestKey);
    }

    textExtractionCache.set(cacheKey, {
      ...processedResult,
      timestamp: Date.now(),
    });

    return processedResult;
  } catch (error) {
    console.error("Text extraction error:", error);
    return { text: "", confidence: 0, words: [] };
  }
}

// Normalize and clean text for better comparison
function normalizeText(text: string): string {
  if (!text) return "";

  return (
    text
      .toLowerCase()
      .trim()
      // Replace multiple spaces with a single space
      .replace(/\s+/g, " ")
      // Remove special characters that might interfere with comparison
      .replace(/[^\w\s.,;:!?@#$%&*()-_+=[\]{}|<>/\\'"` ]/g, "")
      // Remove common OCR errors
      .replace(/[|]l/g, "l")
      .replace(/[0]o/g, "o")
      .replace(/[1]l/g, "l")
      .replace(/[5]s/g, "s")
      .replace(/[8]b/g, "b")
  );
}

// Enhanced text similarity calculation with semantic understanding
export function calculateTextSimilarity(
  textA: { text: string; words: Array<{ text: string; confidence: number }> },
  textB: { text: string; words: Array<{ text: string; confidence: number }> }
): number {
  // If either text is empty, return 0 similarity
  if (
    !textA?.text ||
    !textB?.text ||
    !textA?.words?.length ||
    !textB?.words?.length
  ) {
    return 0;
  }

  // Extract words from both texts and create word maps for faster lookup
  const wordsMapA = new Map<string, { confidence: number; count: number }>();
  const wordsMapB = new Map<string, { confidence: number; count: number }>();

  // Process words from text A
  for (const wordObj of textA.words) {
    const word = wordObj.text;
    if (word.length < 2) continue; // Skip very short words

    const existing = wordsMapA.get(word);
    if (existing) {
      existing.count++;
      existing.confidence = Math.max(existing.confidence, wordObj.confidence);
    } else {
      wordsMapA.set(word, { confidence: wordObj.confidence, count: 1 });
    }
  }

  // Process words from text B
  for (const wordObj of textB.words) {
    const word = wordObj.text;
    if (word.length < 2) continue; // Skip very short words

    const existing = wordsMapB.get(word);
    if (existing) {
      existing.count++;
      existing.confidence = Math.max(existing.confidence, wordObj.confidence);
    } else {
      wordsMapB.set(word, { confidence: wordObj.confidence, count: 1 });
    }
  }

  // Calculate Jaccard similarity with word frequency and importance
  let intersectionWeight = 0;
  let unionWeight = 0;

  // Calculate weighted intersection
  for (const [word, infoA] of wordsMapA.entries()) {
    const infoB = wordsMapB.get(word);
    if (infoB) {
      // Weight by confidence, count, word length, and word importance
      const wordImportance = calculateWordImportance(word);
      const matchWeight =
        infoA.confidence *
        infoB.confidence *
        Math.min(infoA.count, infoB.count) *
        wordImportance;
      intersectionWeight += matchWeight;
    }
  }

  // Calculate weighted union
  for (const [word, infoA] of wordsMapA.entries()) {
    const wordImportance = calculateWordImportance(word);
    unionWeight += infoA.confidence * infoA.count * wordImportance;
  }

  for (const [word, infoB] of wordsMapB.entries()) {
    // Only add words not in A to avoid double counting
    if (!wordsMapA.has(word)) {
      const wordImportance = calculateWordImportance(word);
      unionWeight += infoB.confidence * infoB.count * wordImportance;
    }
  }

  // Calculate weighted Jaccard similarity
  const weightedJaccardSim =
    unionWeight > 0 ? intersectionWeight / unionWeight : 0;

  // Calculate exact phrase matches for higher precision
  const phraseBonus = calculatePhraseMatches(textA.text, textB.text);

  // Calculate fuzzy word matches for words that are similar but not identical
  const fuzzyMatchScore = calculateFuzzyMatches(wordsMapA, wordsMapB);

  // Combine metrics with appropriate weights
  return weightedJaccardSim * 0.5 + phraseBonus * 0.3 + fuzzyMatchScore * 0.2;
}

// Calculate word importance based on length and content
function calculateWordImportance(word: string): number {
  // Longer words are generally more important
  const lengthImportance = Math.min(1, word.length / 5);

  // Common stop words are less important
  const stopWords = new Set([
    "the",
    "and",
    "a",
    "an",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "by",
    "as",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "but",
    "or",
    "if",
    "then",
    "else",
    "when",
    "up",
    "down",
    "out",
    "in",
    "that",
    "this",
    "these",
    "those",
  ]);

  const contentImportance = stopWords.has(word) ? 0.3 : 1.0;

  // Numbers and special characters might be important in certain contexts
  const hasNumbers = /\d/.test(word);
  const hasSpecial = /[.,;:!?@#$%&*()-_+=[\]{}|<>/\\'"` ]/.test(word);
  const specialImportance = hasNumbers || hasSpecial ? 1.2 : 1.0;

  return lengthImportance * contentImportance * specialImportance;
}

// Helper function to find common phrases between texts
function calculatePhraseMatches(textA: string, textB: string): number {
  if (!textA || !textB) return 0;

  // Normalize texts
  const normalizedA = textA.replace(/\s+/g, " ").trim();
  const normalizedB = textB.replace(/\s+/g, " ").trim();

  // Split into words
  const wordsA = normalizedA.split(" ");
  const wordsB = normalizedB.split(" ");

  if (wordsA.length < 2 || wordsB.length < 2) return 0;

  let maxPhraseLength = 0;
  let totalPhraseMatches = 0;
  let weightedPhraseScore = 0;

  // Check for phrases of increasing length
  for (
    let phraseLength = 2;
    phraseLength <= Math.min(6, Math.min(wordsA.length, wordsB.length));
    phraseLength++
  ) {
    const phrasesA = new Set<string>();

    // Generate all phrases of current length from text A
    for (let i = 0; i <= wordsA.length - phraseLength; i++) {
      const phrase = wordsA.slice(i, i + phraseLength).join(" ");
      phrasesA.add(phrase);
    }

    // Check if phrases from text B exist in text A
    for (let i = 0; i <= wordsB.length - phraseLength; i++) {
      const phrase = wordsB.slice(i, i + phraseLength).join(" ");
      if (phrasesA.has(phrase)) {
        totalPhraseMatches++;
        maxPhraseLength = Math.max(maxPhraseLength, phraseLength);

        // Longer phrases are more significant
        weightedPhraseScore += phraseLength * 0.1;
      }
    }
  }

  // Calculate phrase match score based on matches and max phrase length
  const phraseMatchScore =
    totalPhraseMatches > 0 ? weightedPhraseScore + maxPhraseLength * 0.1 : 0;

  return Math.min(1, phraseMatchScore); // Cap at 1.0
}

// Calculate fuzzy matches between words that are similar but not identical
function calculateFuzzyMatches(
  wordsMapA: Map<string, { confidence: number; count: number }>,
  wordsMapB: Map<string, { confidence: number; count: number }>
): number {
  let fuzzyMatchScore = 0;
  const processedPairs = new Set<string>();

  // For each word in A, find similar words in B
  for (const [wordA, infoA] of wordsMapA.entries()) {
    if (wordA.length < 4) continue; // Skip very short words for fuzzy matching

    for (const [wordB, infoB] of wordsMapB.entries()) {
      if (wordB.length < 4) continue;

      // Skip if exact match (already counted in Jaccard similarity)
      if (wordA === wordB) continue;

      // Skip if already processed this pair
      const pairKey = `${wordA}:${wordB}`;
      if (processedPairs.has(pairKey)) continue;
      processedPairs.add(pairKey);

      // Calculate Levenshtein distance
      const distance = levenshteinDistance(wordA, wordB);
      const maxLength = Math.max(wordA.length, wordB.length);

      // Calculate similarity as 1 - normalized distance
      const similarity = 1 - distance / maxLength;

      // Only count if similarity is high enough
      if (similarity > 0.75) {
        const wordImportance = calculateWordImportance(wordA);
        const matchWeight =
          similarity * infoA.confidence * infoB.confidence * wordImportance;
        fuzzyMatchScore += matchWeight;
      }
    }
  }

  // Normalize the score
  return Math.min(1, fuzzyMatchScore / Math.max(1, wordsMapA.size));
}

// Calculate Levenshtein distance between two strings
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize the matrix
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }

  // Fill the matrix
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[a.length][b.length];
}

// Terminate the OCR worker when no longer needed
export async function terminateOCR(): Promise<void> {
  if (ocrWorker) {
    await ocrWorker.terminate();
    ocrWorker = null;
  }

  // Clear the cache
  textExtractionCache.clear();
}
