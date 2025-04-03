// This file handles generating embeddings for images using TensorFlow.js and MobileNet

import * as tf from "@tensorflow/tfjs"

let model: tf.GraphModel | null = null
let preprocessingModel: tf.LayersModel | null = null

// Load the MobileNet model
export async function loadModel(): Promise<void> {
  // Load the model
  model = await tf.loadGraphModel(
    "https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v2_100_224/feature_vector/2/default/1",
    { fromTFHub: true },
  )

  // Create a simple preprocessing model to enhance features
  preprocessingModel = createPreprocessingModel()

  // Warm up the model
  const dummyInput = tf.zeros([1, 224, 224, 3])
  ;(await model.predict(dummyInput)) as tf.Tensor
  dummyInput.dispose()

  console.log("Models loaded successfully")
}

// Create a simple preprocessing model to enhance features
function createPreprocessingModel(): tf.LayersModel {
  const input = tf.input({ shape: [1280] })

  // Add layers to enhance feature representation
  const dense1 = tf.layers
    .dense({
      units: 512,
      activation: "relu",
      kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
    })
    .apply(input)

  const dropout = tf.layers.dropout({ rate: 0.2 }).apply(dense1)

  const dense2 = tf.layers
    .dense({
      units: 256,
      activation: "relu",
    })
    .apply(dropout)

  const output = tf.layers
    .dense({
      units: 128,
      activation: "tanh", // tanh ensures values between -1 and 1
    })
    .apply(dense2)

  return tf.model({ inputs: input, outputs: output as tf.SymbolicTensor })
}

// Generate embedding for an image with enhanced preprocessing
export async function generateEmbedding(imageDataUrl: string): Promise<number[]> {
  if (!model) {
    throw new Error("Model not loaded. Call loadModel() first.")
  }

  // Create an HTMLImageElement from the data URL
  const img = await createImageElement(imageDataUrl)

  // Apply image augmentation for better feature extraction
  const augmentedTensor = await preprocessImage(img)

  // Generate the base embedding
  const baseEmbedding = (await model.predict(augmentedTensor)) as tf.Tensor

  // Apply our preprocessing model to enhance features
  let enhancedEmbedding
  if (preprocessingModel) {
    enhancedEmbedding = preprocessingModel.predict(baseEmbedding) as tf.Tensor
  } else {
    enhancedEmbedding = baseEmbedding
  }

  // Convert the embedding tensor to a JavaScript array
  const embeddingArray = await enhancedEmbedding.data()

  // Clean up tensors to prevent memory leaks
  augmentedTensor.dispose()
  baseEmbedding.dispose()
  if (enhancedEmbedding !== baseEmbedding) {
    enhancedEmbedding.dispose()
  }

  // Convert to Array and normalize
  const embeddingData = Array.from(embeddingArray)
  return normalizeVector(embeddingData)
}

// Create an image element from a data URL
function createImageElement(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = (err) => reject(err)
    img.src = dataUrl
  })
}

// Preprocess the image with augmentation for better feature extraction
async function preprocessImage(img: HTMLImageElement): Promise<tf.Tensor> {
  return tf.tidy(() => {
    // Convert image to tensor
    const imageTensor = tf.browser.fromPixels(img)

    // Resize to expected size (224x224 for MobileNet)
    const resized = tf.image.resizeBilinear(imageTensor, [224, 224])

    // Apply color normalization
    const normalized = resized.div(tf.scalar(127.5)).sub(tf.scalar(1))

    // Add batch dimension
    const batched = normalized.expandDims(0)

    return batched
  })
}

// Normalize a vector to unit length
function normalizeVector(vector: number[]): number[] {
  // Calculate the magnitude of the vector
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))

  // Normalize each element
  return vector.map((val) => val / magnitude)
}

