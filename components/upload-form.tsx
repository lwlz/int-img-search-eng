// Update the upload form to use enhanced text extraction
"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Upload, ImagePlus, Loader2, FileText, X, Plus, Settings2 } from "lucide-react"
import { storeImage } from "@/lib/db"
import { generateEmbedding } from "@/lib/embedding"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { extractTextFromImage } from "@/lib/text-recognition"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

export default function UploadForm() {
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState<{
    type: "success" | "error" | null
    message: string
  }>({ type: null, message: "" })

  // OCR settings
  const [enhanceImageForOCR, setEnhanceImageForOCR] = useState(true)

  // Single image upload state
  const [preview, setPreview] = useState<string | null>(null)
  const [extractedText, setExtractedText] = useState<{
    text: string
    confidence: number
    words: Array<{ text: string; confidence: number }>
  } | null>(null)
  const [textExtractionStatus, setTextExtractionStatus] = useState<"idle" | "processing" | "success" | "error">("idle")

  // Multiple image upload state
  const [multipleImages, setMultipleImages] = useState<
    Array<{
      dataUrl: string
      textContent?: {
        text: string
        confidence: number
        words: Array<{ text: string; confidence: number }>
      } | null
      textStatus: "idle" | "processing" | "success" | "error"
    }>
  >([])

  // Use refs to track active processes
  const activeTextExtractionRef = useRef<boolean>(false)
  const activeUploadRef = useRef<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const multipleFileInputRef = useRef<HTMLInputElement>(null)

  // Optimize image loading with resize
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Reset states
      setExtractedText(null)
      setTextExtractionStatus("idle")
      setUploadStatus({ type: null, message: "" })

      // Optimize image loading
      const reader = new FileReader()
      reader.onloadend = () => {
        const img = new Image()
        img.onload = () => {
          // Resize large images for better performance
          const maxDimension = 1200
          let width = img.width
          let height = img.height

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height / width) * maxDimension)
              width = maxDimension
            } else {
              width = Math.round((width / height) * maxDimension)
              height = maxDimension
            }

            const canvas = document.createElement("canvas")
            canvas.width = width
            canvas.height = height
            const ctx = canvas.getContext("2d")

            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height)
              setPreview(canvas.toDataURL("image/jpeg", 0.92))
            } else {
              setPreview(img.src)
            }
          } else {
            setPreview(img.src)
          }
        }
        img.src = reader.result as string
      }
      reader.readAsDataURL(file)
    }
  }

  // Handle multiple file selection
  const handleMultipleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    // Reset status
    setUploadStatus({ type: null, message: "" })

    // Process each file
    Array.from(files).forEach((file) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const img = new Image()
        img.onload = () => {
          // Resize large images
          const maxDimension = 1200
          let width = img.width
          let height = img.height

          let dataUrl = img.src

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height / width) * maxDimension)
              width = maxDimension
            } else {
              width = Math.round((width / height) * maxDimension)
              height = maxDimension
            }

            const canvas = document.createElement("canvas")
            canvas.width = width
            canvas.height = height
            const ctx = canvas.getContext("2d")

            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height)
              dataUrl = canvas.toDataURL("image/jpeg", 0.92)
            }
          }

          // Add to images array
          setMultipleImages((prev) => [
            ...prev,
            {
              dataUrl,
              textContent: null,
              textStatus: "idle",
            },
          ])
        }
        img.src = reader.result as string
      }
      reader.readAsDataURL(file)
    })
  }

  // Extract text when an image is selected with debouncing
  useEffect(() => {
    if (!preview || textExtractionStatus !== "idle" || activeTextExtractionRef.current) {
      return
    }

    const extractText = async () => {
      setTextExtractionStatus("processing")
      activeTextExtractionRef.current = true

      try {
        // Use quick mode for UI preview with enhanced image processing
        const result = await extractTextFromImage(preview, {
          quick: true,
          enhanceImage: enhanceImageForOCR,
        })
        setExtractedText(result)
        setTextExtractionStatus(result.text ? "success" : "error")
      } catch (error) {
        console.error("Text extraction error:", error)
        setTextExtractionStatus("error")
      } finally {
        activeTextExtractionRef.current = false
      }
    }

    // Small delay to avoid processing during rapid changes
    const timer = setTimeout(() => {
      extractText()
    }, 100)

    return () => clearTimeout(timer)
  }, [preview, textExtractionStatus, enhanceImageForOCR])

  // Process text extraction for multiple images
  useEffect(() => {
    const processNextImage = async () => {
      // Find the first image that needs text extraction
      const index = multipleImages.findIndex((img) => img.textStatus === "idle")
      if (index === -1) return

      // Update status to processing
      setMultipleImages((prev) => {
        const updated = [...prev]
        updated[index] = { ...updated[index], textStatus: "processing" }
        return updated
      })

      try {
        // Extract text with enhanced image processing
        const result = await extractTextFromImage(multipleImages[index].dataUrl, {
          quick: true,
          enhanceImage: enhanceImageForOCR,
        })

        // Update with result
        setMultipleImages((prev) => {
          const updated = [...prev]
          updated[index] = {
            ...updated[index],
            textContent: result,
            textStatus: result.text ? "success" : "error",
          }
          return updated
        })
      } catch (error) {
        console.error("Text extraction error:", error)

        // Update with error
        setMultipleImages((prev) => {
          const updated = [...prev]
          updated[index] = { ...updated[index], textStatus: "error" }
          return updated
        })
      }
    }

    // If there are images waiting for text extraction, process one
    if (
      multipleImages.some((img) => img.textStatus === "idle") &&
      !multipleImages.some((img) => img.textStatus === "processing")
    ) {
      processNextImage()
    }
  }, [multipleImages, enhanceImageForOCR])

  // Optimized upload process with progress tracking
  const handleUpload = async () => {
    if (!preview || isUploading || activeUploadRef.current) return

    try {
      setIsUploading(true)
      activeUploadRef.current = true
      setProgress(10)
      setUploadStatus({ type: null, message: "" })

      // Start embedding generation
      setProgress(20)
      const embeddingPromise = generateEmbedding(preview)

      // Extract text with full processing if needed
      let textContent = extractedText
      let textPromise

      if (!textContent || textExtractionStatus === "processing") {
        setProgress(30)
        textPromise = extractTextFromImage(preview, {
          forceRefresh: true,
          enhanceImage: enhanceImageForOCR,
        })
      }

      // Wait for embedding to complete
      const embedding = await embeddingPromise
      setProgress(60)

      // Wait for text extraction if needed
      if (textPromise) {
        textContent = await textPromise
        setProgress(80)
      }

      // Store the image with all data
      await storeImage({
        id: Date.now().toString(),
        dataUrl: preview,
        embedding,
        timestamp: new Date().toISOString(),
        textContent: textContent || undefined,
      })

      setProgress(100)
      setUploadStatus({
        type: "success",
        message: "Image uploaded and indexed successfully!",
      })

      // Reset after successful upload
      setTimeout(() => {
        setPreview(null)
        setProgress(0)
        setExtractedText(null)
        setTextExtractionStatus("idle")
      }, 1500)
    } catch (error) {
      console.error("Upload error:", error)
      setUploadStatus({
        type: "error",
        message: "Failed to process image. Please try again with a different image.",
      })
      setProgress(0)
    } finally {
      setIsUploading(false)
      activeUploadRef.current = false
    }
  }

  // Handle multiple image upload
  const handleMultipleUpload = async () => {
    if (multipleImages.length === 0 || isUploading) return

    try {
      setIsUploading(true)
      setProgress(0)
      setUploadStatus({ type: null, message: "" })

      let successCount = 0
      let errorCount = 0

      // Process each image
      for (let i = 0; i < multipleImages.length; i++) {
        const image = multipleImages[i]

        // Update progress
        setProgress(Math.round((i / multipleImages.length) * 100))

        try {
          // Generate embedding
          const embedding = await generateEmbedding(image.dataUrl)

          // Ensure text extraction is complete
          let textContent = image.textContent
          if (!textContent && image.textStatus !== "error") {
            try {
              textContent = await extractTextFromImage(image.dataUrl, {
                forceRefresh: true,
                enhanceImage: enhanceImageForOCR,
              })
            } catch (error) {
              console.error("Text extraction error during upload:", error)
            }
          }

          // Store the image
          await storeImage({
            id: Date.now().toString() + i,
            dataUrl: image.dataUrl,
            embedding,
            timestamp: new Date().toISOString(),
            textContent: textContent || undefined,
          })

          successCount++
        } catch (error) {
          console.error(`Error processing image ${i}:`, error)
          errorCount++
        }
      }

      // Complete
      setProgress(100)
      setUploadStatus({
        type: errorCount === 0 ? "success" : "error",
        message: `${successCount} image${successCount !== 1 ? "s" : ""} uploaded successfully${
          errorCount > 0 ? `, ${errorCount} failed` : ""
        }.`,
      })

      // Reset after successful upload
      setTimeout(() => {
        setMultipleImages([])
        setProgress(0)
      }, 2000)
    } catch (error) {
      console.error("Multiple upload error:", error)
      setUploadStatus({
        type: "error",
        message: "Failed to process images. Please try again.",
      })
      setProgress(0)
    } finally {
      setIsUploading(false)
    }
  }

  // Remove an image from the multiple images array
  const removeImage = (index: number) => {
    setMultipleImages((prev) => prev.filter((_, i) => i !== index))
  }

  // Retry text extraction for a specific image
  const retryTextExtraction = async (index: number) => {
    if (!multipleImages[index]) return

    setMultipleImages((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], textStatus: "processing" }
      return updated
    })

    try {
      // Try with enhanced image processing
      const result = await extractTextFromImage(multipleImages[index].dataUrl, {
        forceRefresh: true,
        enhanceImage: enhanceImageForOCR,
      })

      setMultipleImages((prev) => {
        const updated = [...prev]
        updated[index] = {
          ...updated[index],
          textContent: result,
          textStatus: result.text ? "success" : "error",
        }
        return updated
      })
    } catch (error) {
      console.error("Text extraction retry error:", error)

      setMultipleImages((prev) => {
        const updated = [...prev]
        updated[index] = { ...updated[index], textStatus: "error" }
        return updated
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold mb-2">Upload Images to Database</h2>
          <p className="text-muted-foreground">Add images to your local database for vector similarity search</p>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings2 className="h-4 w-4 mr-2" />
              OCR Settings
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-4">
              <h4 className="font-medium">Text Recognition Settings</h4>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="enhance-image">Enhance images for OCR</Label>
                  <p className="text-xs text-muted-foreground">Improves text detection by preprocessing images</p>
                </div>
                <Switch id="enhance-image" checked={enhanceImageForOCR} onCheckedChange={setEnhanceImageForOCR} />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <Tabs defaultValue="single" className="w-full">
        <TabsList className="grid grid-cols-2 mb-4">
          <TabsTrigger value="single">Single Image</TabsTrigger>
          <TabsTrigger value="multiple">Multiple Images</TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          <Card className="border-dashed border-2 p-6 text-center">
            {preview ? (
              <div className="space-y-4">
                <div className="relative w-64 h-64 mx-auto">
                  <img
                    src={preview || "/placeholder.svg"}
                    alt="Preview"
                    className="w-full h-full object-cover rounded-md"
                    loading="eager"
                  />

                  {textExtractionStatus === "processing" && (
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center rounded-md">
                      <div className="bg-white p-2 rounded-md flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-xs">Analyzing text...</span>
                      </div>
                    </div>
                  )}

                  {textExtractionStatus === "success" && (
                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary" className="flex items-center gap-1 bg-green-100">
                        <FileText className="h-3 w-3" />
                        <span className="text-xs">Text detected</span>
                      </Badge>
                    </div>
                  )}
                </div>

                {extractedText && extractedText.text && (
                  <div className="max-w-md mx-auto">
                    <div className="bg-muted p-3 rounded-md text-left">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium flex items-center gap-1">
                          <FileText className="h-4 w-4" />
                          Detected Text
                        </h3>
                        <Badge variant={extractedText.confidence > 0.7 ? "default" : "outline"} className="text-xs">
                          {Math.round(extractedText.confidence * 100)}% confidence
                        </Badge>
                      </div>
                      <p className="text-sm whitespace-pre-wrap break-words max-h-20 overflow-y-auto">
                        {extractedText.text || "No clear text detected"}
                      </p>
                      {extractedText.words.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {extractedText.words.slice(0, 8).map((word, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {word.text}
                            </Badge>
                          ))}
                          {extractedText.words.length > 8 && (
                            <Badge variant="outline" className="text-xs">
                              +{extractedText.words.length - 8} more
                            </Badge>
                          )}
                        </div>
                      )}

                      {textExtractionStatus === "error" ||
                        (!extractedText.text && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => {
                              setTextExtractionStatus("idle")
                            }}
                          >
                            Retry Text Detection
                          </Button>
                        ))}
                    </div>
                  </div>
                )}

                {isUploading && (
                  <div className="w-full max-w-xs mx-auto">
                    <Progress value={progress} className="h-2" />
                    <p className="text-sm text-muted-foreground mt-2">
                      {progress < 20
                        ? "Preparing image..."
                        : progress < 60
                          ? "Generating vector embedding..."
                          : progress < 80
                            ? "Analyzing text content..."
                            : "Storing in database..."}
                    </p>
                  </div>
                )}
                <div className="flex justify-center gap-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPreview(null)
                      setExtractedText(null)
                      setTextExtractionStatus("idle")
                    }}
                    disabled={isUploading}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleUpload} disabled={isUploading}>
                    {isUploading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        Upload
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-48 cursor-pointer">
                <ImagePlus className="h-12 w-12 text-muted-foreground mb-2" />
                <span className="text-muted-foreground">Click to select an image or drag and drop</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                  onClick={(e) => {
                    // Reset the input value to allow selecting the same file again
                    ;(e.target as HTMLInputElement).value = ""
                  }}
                />
              </label>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="multiple">
          <Card className="border-dashed border-2 p-6">
            {multipleImages.length > 0 ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {multipleImages.map((image, index) => (
                    <div key={index} className="relative aspect-square rounded-md border overflow-hidden group">
                      <img
                        src={image.dataUrl || "/placeholder.svg"}
                        alt={`Image ${index + 1}`}
                        className="w-full h-full object-cover"
                      />

                      {/* Text indicator */}
                      {image.textStatus === "processing" && (
                        <div className="absolute top-2 right-2">
                          <Badge variant="outline" className="bg-white/80 flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span className="text-xs">Processing</span>
                          </Badge>
                        </div>
                      )}

                      {image.textStatus === "success" && (
                        <div className="absolute top-2 right-2">
                          <Badge variant="secondary" className="flex items-center gap-1 bg-green-100">
                            <FileText className="h-3 w-3" />
                            <span className="text-xs">Text detected</span>
                          </Badge>
                        </div>
                      )}

                      {image.textStatus === "error" && (
                        <div className="absolute top-2 right-2">
                          <Badge
                            variant="outline"
                            className="bg-white/80 flex items-center gap-1 cursor-pointer hover:bg-white"
                            onClick={() => retryTextExtraction(index)}
                          >
                            <X className="h-3 w-3 text-red-500" />
                            <span className="text-xs">Retry</span>
                          </Badge>
                        </div>
                      )}

                      {/* Text preview on hover */}
                      {image.textContent?.text && (
                        <div className="absolute inset-0 bg-black/70 text-white p-2 opacity-0 group-hover:opacity-100 transition-opacity overflow-auto text-xs">
                          <p className="font-medium mb-1">Detected Text:</p>
                          <p>{image.textContent.text}</p>
                        </div>
                      )}

                      {/* Remove button */}
                      <button
                        className="absolute top-2 left-2 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeImage(index)}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}

                  {/* Add more button */}
                  <label className="aspect-square rounded-md border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors">
                    <Plus className="h-8 w-8 text-muted-foreground mb-1" />
                    <span className="text-xs text-muted-foreground">Add more</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleMultipleFileChange}
                      onClick={(e) => {
                        ;(e.target as HTMLInputElement).value = ""
                      }}
                    />
                  </label>
                </div>

                {isUploading && (
                  <div className="w-full max-w-md mx-auto">
                    <Progress value={progress} className="h-2" />
                    <p className="text-sm text-muted-foreground mt-2">
                      Uploading {multipleImages.length} images: {Math.round(progress)}%
                    </p>
                  </div>
                )}

                <div className="flex justify-center gap-4">
                  <Button variant="outline" onClick={() => setMultipleImages([])} disabled={isUploading}>
                    Cancel
                  </Button>
                  <Button onClick={handleMultipleUpload} disabled={isUploading}>
                    {isUploading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Uploading...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        Upload {multipleImages.length} Images
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-48 cursor-pointer">
                <ImagePlus className="h-12 w-12 text-muted-foreground mb-2" />
                <span className="text-muted-foreground">Click to select multiple images or drag and drop</span>
                <p className="text-xs text-muted-foreground mt-1">You can select multiple files at once</p>
                <input
                  ref={multipleFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleMultipleFileChange}
                  onClick={(e) => {
                    // Reset the input value to allow selecting the same files again
                    ;(e.target as HTMLInputElement).value = ""
                  }}
                />
              </label>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {uploadStatus.type && (
        <Alert variant={uploadStatus.type === "success" ? "default" : "destructive"} className="mt-4">
          <AlertDescription>{uploadStatus.message}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

