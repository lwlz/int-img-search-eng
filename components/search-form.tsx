"use client";

import type React from "react";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Camera,
  Search,
  RefreshCw,
  Upload,
  FileText,
  Loader2,
} from "lucide-react";
import { generateEmbedding } from "@/lib/embedding";
import { searchImagesByEmbedding } from "@/lib/db";
import { Alert, AlertDescription } from "@/components/ui/alert";
import CameraFallback from "@/components/camera-fallback";
import { extractTextFromImage } from "@/lib/text-recognition";
import { Badge } from "@/components/ui/badge";

interface SearchFormProps {
  onSearchResults: (results: any[]) => void;
  setIsLoading: (loading: boolean) => void;
}

export default function SearchForm({
  onSearchResults,
  setIsLoading,
}: SearchFormProps) {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCameraFallback, setShowCameraFallback] = useState(false);
  const [extractedText, setExtractedText] = useState<{
    text: string;
    confidence: number;
    words: Array<{ text: string; confidence: number }>;
  } | null>(null);
  const [textExtractionStatus, setTextExtractionStatus] = useState<
    "idle" | "processing" | "success" | "error"
  >("idle");

  // Use refs to track active processes
  const activeTextExtractionRef = useRef<boolean>(false);
  const activeSearchRef = useRef<boolean>(false);

  // Memoized camera start function to prevent unnecessary re-renders
  const startCamera = useCallback(async () => {
    try {
      setError(null);
      console.log("Starting camera...");

      // Check if mediaDevices is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error("Camera API not available in this browser");
        setError(
          "Camera not supported in this browser. Please try uploading an image instead."
        );
        return;
      }

      // Set camera active first to ensure the video element is rendered
      setCameraActive(true);

      // Small delay to ensure the video element is rendered
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check if video element exists after rendering
      if (!videoRef.current) {
        console.error("Video element not found after rendering");
        setError(
          "Camera initialization failed. Please try uploading an image instead."
        );
        setCameraActive(false);
        return;
      }

      console.log("Requesting camera permission...");

      // Try to get the camera stream with explicit error handling
      let stream;
      try {
        // First try to get the rear camera (for mobile)
        console.log("Attempting to access rear camera...");
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: "environment" } },
          audio: false,
        });
      } catch (e) {
        console.log("Rear camera failed, trying any camera...", e);
        // If rear camera fails, try any camera
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        } catch (innerError) {
          console.error("All camera access failed:", innerError);
          setError(
            "Could not access camera with standard methods. Try the alternative camera method below."
          );
          setShowCameraFallback(true);
          setCameraActive(false);
          return;
        }
      }

      console.log("Camera stream obtained:", stream);

      // Make sure we have a valid stream with video tracks
      if (!stream || !stream.getVideoTracks().length) {
        console.error("No video tracks in stream");
        setError(
          "Camera stream is not available. Please try again or upload an image instead."
        );
        setCameraActive(false);
        return;
      }

      // Double check that video element exists
      if (!videoRef.current) {
        console.error("Video element not found after getting stream");
        setError(
          "Camera initialization failed. Please reload the page and try again."
        );
        setCameraActive(false);
        return;
      }

      // Connect the stream to the video element
      videoRef.current.srcObject = stream;
      streamRef.current = stream;

      // Add explicit event handlers for video element
      videoRef.current.onloadedmetadata = () => {
        console.log("Video metadata loaded, playing video...");
        if (videoRef.current) {
          // Use play() as a promise
          videoRef.current
            .play()
            .then(() => {
              console.log("Camera started successfully");
            })
            .catch((playError) => {
              console.error("Error playing video:", playError);
              setError(
                "Could not start video stream. Please try again or check autoplay settings in your browser."
              );
              if (stream) {
                stream.getTracks().forEach((track) => track.stop());
              }
              setCameraActive(false);
            });
        }
      };

      videoRef.current.onerror = (e) => {
        console.error("Video element error:", e);
        setError("Error with video display. Please try again.");
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }
        setCameraActive(false);
      };
    } catch (error) {
      console.error("Camera initialization error:", error);
      setError(
        "Could not access camera. Please check permissions or try uploading an image instead."
      );
      setCameraActive(false);
    }
  }, []);

  // Optimized camera stop function
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setCameraActive(false);
    }
  }, []);

  // Optimized image capture function
  const captureImage = useCallback(() => {
    console.log("Attempting to capture image...");

    if (!videoRef.current) {
      console.error("Video element not found");
      setError("Camera not initialized. Please try again.");
      return;
    }

    // Check if video is playing and has dimensions
    if (videoRef.current.readyState < 2) {
      console.error(
        "Video not ready yet, readyState:",
        videoRef.current.readyState
      );
      setError("Camera not ready. Please wait a moment and try again.");
      return;
    }

    const videoWidth = videoRef.current.videoWidth;
    const videoHeight = videoRef.current.videoHeight;

    console.log(`Video dimensions: ${videoWidth}x${videoHeight}`);

    // Ensure we have valid dimensions
    if (!videoWidth || !videoHeight) {
      console.error("Invalid video dimensions");
      setError("Could not capture image. Please try again.");
      return;
    }

    try {
      const canvas = document.createElement("canvas");
      canvas.width = videoWidth;
      canvas.height = videoHeight;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        console.error("Could not get canvas context");
        setError("Failed to process camera image. Please try again.");
        return;
      }

      // Draw the current video frame to the canvas
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

      // Convert to data URL with optimized quality
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      console.log("Image captured successfully");

      // Set the captured image and clean up
      setCapturedImage(dataUrl);
      setUploadedImage(null);
      setExtractedText(null);
      setTextExtractionStatus("idle");
      stopCamera();
    } catch (e) {
      console.error("Error capturing image:", e);
      setError("Failed to capture image. Please try again.");
    }
  }, [stopCamera]);

  // Optimized file upload handler
  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        // Reset states
        setExtractedText(null);
        setTextExtractionStatus("idle");

        // Optimize image loading
        const reader = new FileReader();
        reader.onloadend = () => {
          const img = new Image();
          img.onload = () => {
            // Resize large images for better performance
            const maxDimension = 1200;
            let width = img.width;
            let height = img.height;

            if (width > maxDimension || height > maxDimension) {
              if (width > height) {
                height = Math.round((height / width) * maxDimension);
                width = maxDimension;
              } else {
                width = Math.round((width / height) * maxDimension);
                height = maxDimension;
              }

              const canvas = document.createElement("canvas");
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext("2d");

              if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                setUploadedImage(canvas.toDataURL("image/jpeg", 0.92));
              } else {
                setUploadedImage(img.src);
              }
            } else {
              setUploadedImage(img.src);
            }

            setCapturedImage(null);
            if (cameraActive) stopCamera();
          };
          img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
      }
    },
    [cameraActive, stopCamera]
  );

  const triggerFileUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Extract text when an image is selected with debouncing
  useEffect(() => {
    const currentImage = capturedImage || uploadedImage;
    if (
      !currentImage ||
      textExtractionStatus !== "idle" ||
      activeTextExtractionRef.current
    ) {
      return;
    }

    const extractText = async () => {
      setTextExtractionStatus("processing");
      activeTextExtractionRef.current = true;

      try {
        // Use quick mode for UI preview
        const result = await extractTextFromImage(currentImage, {
          quick: true,
        });
        setExtractedText(result);
        setTextExtractionStatus(result.text ? "success" : "error");
      } catch (error) {
        console.error("Text extraction error:", error);
        setTextExtractionStatus("error");
      } finally {
        activeTextExtractionRef.current = false;
      }
    };

    // Small delay to avoid processing during rapid changes
    const timer = setTimeout(() => {
      extractText();
    }, 100);

    return () => clearTimeout(timer);
  }, [capturedImage, uploadedImage, textExtractionStatus]);

  // Optimized search function with progress tracking
  const handleSearch = useCallback(async () => {
    const imageToSearch = capturedImage || uploadedImage;
    if (!imageToSearch || activeSearchRef.current) return;

    try {
      setError(null);
      setIsLoading(true);
      activeSearchRef.current = true;

      // Generate embedding for the image
      const embedding = await generateEmbedding(imageToSearch);

      // Ensure we have the best text extraction
      let finalTextContent = extractedText;
      if (
        (!finalTextContent || finalTextContent.confidence < 0.7) &&
        textExtractionStatus !== "processing"
      ) {
        try {
          // Try a more thorough extraction for search
          finalTextContent = await extractTextFromImage(imageToSearch, {
            forceRefresh: true,
          });
          setExtractedText(finalTextContent);
        } catch (error) {
          console.error("Text extraction error during search:", error);
          // Continue with existing text content
        }
      }

      // Search for similar images in the database
      const results = await searchImagesByEmbedding(
        embedding,
        finalTextContent || undefined
      );

      if (results.length === 0) {
        setError(
          "No similar images found. Try uploading more images to your database first."
        );
      }

      onSearchResults(results);
    } catch (error) {
      console.error("Search error:", error);
      setError(
        "Failed to process search. Please try again with a different image."
      );
      onSearchResults([]);
    } finally {
      setIsLoading(false);
      activeSearchRef.current = false;
    }
  }, [
    capturedImage,
    uploadedImage,
    extractedText,
    textExtractionStatus,
    setIsLoading,
    onSearchResults,
  ]);

  // Reset search state
  const resetSearch = useCallback(() => {
    setCapturedImage(null);
    setUploadedImage(null);
    setError(null);
    setExtractedText(null);
    setTextExtractionStatus("idle");
    onSearchResults([]);
  }, [onSearchResults]);

  const currentImage = capturedImage || uploadedImage;

  // Handle fallback camera capture
  const handleFallbackCapture = useCallback((imageDataUrl: string) => {
    setCapturedImage(imageDataUrl);
    setUploadedImage(null);
    setExtractedText(null);
    setTextExtractionStatus("idle");
    setShowCameraFallback(false);
  }, []);

  // Clean up resources when component unmounts
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Search Similar Images</h2>
        <p className="text-muted-foreground">
          Take a photo or upload an image to find similar images in your
          database
        </p>
      </div>

      <Card className="border-2 p-4 text-center">
        {currentImage ? (
          <div className="space-y-4">
            <div className="relative w-64 h-64 mx-auto">
              <img
                src={currentImage || "/placeholder.svg"}
                alt="Image for search"
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
                  <Badge
                    variant="secondary"
                    className="flex items-center gap-1 bg-green-100"
                  >
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
                    <Badge
                      variant={
                        extractedText.confidence > 0.7 ? "default" : "outline"
                      }
                      className="text-xs"
                    >
                      {Math.round(extractedText.confidence * 100)}% confidence
                    </Badge>
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words max-h-20 overflow-y-auto">
                    {extractedText.text || "No clear text detected"}
                  </p>
                  {extractedText?.words?.length > 0 && (
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
                </div>
              </div>
            )}

            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={resetSearch}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset
              </Button>
              <Button onClick={handleSearch} disabled={activeSearchRef.current}>
                <Search className="h-4 w-4 mr-2" />
                Find Similar Images
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {cameraActive ? (
              <>
                <div className="relative w-64 h-64 mx-auto overflow-hidden rounded-md">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex justify-center gap-4">
                  <Button variant="outline" onClick={stopCamera}>
                    Cancel
                  </Button>
                  <Button onClick={captureImage}>
                    <Camera className="h-4 w-4 mr-2" />
                    Capture
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  If you can't see your camera, please check your browser
                  permissions
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 gap-4">
                <Button onClick={startCamera}>
                  <Camera className="h-4 w-4 mr-2" />
                  Open Camera
                </Button>
                <div className="flex items-center">
                  <span className="mx-2 text-muted-foreground">or</span>
                </div>
                <Button variant="outline" onClick={triggerFileUpload}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Image
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                  onClick={(e) => {
                    // Reset the input value to allow selecting the same file again
                    (e.target as HTMLInputElement).value = "";
                  }}
                />
              </div>
            )}
          </div>
        )}
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {error && showCameraFallback && (
        <div className="mt-4 border-t pt-4">
          <h3 className="text-sm font-medium mb-2">
            Alternative Camera Method
          </h3>
          <CameraFallback onImageCaptured={handleFallbackCapture} />
        </div>
      )}
    </div>
  );
}
