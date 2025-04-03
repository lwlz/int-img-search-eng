"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Camera } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface CameraFallbackProps {
  onImageCaptured: (imageDataUrl: string) => void
}

export default function CameraFallback({ onImageCaptured }: CameraFallbackProps) {
  const [error, setError] = useState<string | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [debugInfo, setDebugInfo] = useState<string>("")

  const startCamera = async () => {
    try {
      setError(null)
      setDebugInfo("Starting camera...")

      // Check if mediaDevices is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setDebugInfo("Camera API not available")
        setError("Camera not supported in this browser. Please try another browser.")
        return
      }

      // Set camera active first to ensure the video element is rendered
      setCameraActive(true)

      // Small delay to ensure the video element is rendered
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Check if video element exists after rendering
      if (!videoRef.current) {
        setDebugInfo("Video element not found after rendering")
        setError("Camera initialization failed. Please try uploading an image instead.")
        setCameraActive(false)
        return
      }

      setDebugInfo("Requesting camera permission...")

      // Try different camera options
      let stream
      const constraints = [
        { video: { facingMode: { exact: "environment" } }, audio: false },
        { video: { facingMode: "environment" }, audio: false },
        { video: { facingMode: "user" }, audio: false },
        { video: true, audio: false },
      ]

      let successConstraint = null

      for (let i = 0; i < constraints.length; i++) {
        try {
          setDebugInfo(`Trying camera option ${i + 1}...`)
          stream = await navigator.mediaDevices.getUserMedia(constraints[i])
          successConstraint = constraints[i]
          break
        } catch (e) {
          setDebugInfo(`Option ${i + 1} failed: ${e.message || e}`)
          // Continue to next option
        }
      }

      if (!stream) {
        setError("Could not access any camera. Please check your camera permissions.")
        setCameraActive(false)
        return
      }

      setDebugInfo(`Camera accessed with option: ${JSON.stringify(successConstraint)}`)

      // Double check that video element exists
      if (!videoRef.current) {
        setError("Video element not found. Please reload the page.")
        setCameraActive(false)
        return
      }

      // Connect the stream to the video element
      videoRef.current.srcObject = stream
      streamRef.current = stream

      // Add explicit event handlers for video element
      videoRef.current.onloadedmetadata = () => {
        setDebugInfo("Video metadata loaded, playing video...")
        if (videoRef.current) {
          videoRef.current
            .play()
            .then(() => {
              setDebugInfo("Camera started successfully")
            })
            .catch((playError) => {
              setDebugInfo(`Error playing video: ${playError.message || playError}`)
              setError("Could not start video stream. Please try again.")
              if (stream) {
                stream.getTracks().forEach((track) => track.stop())
              }
              setCameraActive(false)
            })
        }
      }
    } catch (error) {
      setDebugInfo(`Camera error: ${error.message || error}`)
      setError("Could not access camera. Please check permissions.")
      setCameraActive(false)
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      setCameraActive(false)
      setDebugInfo("")
    }
  }

  const captureImage = () => {
    setDebugInfo("Attempting to capture image...")

    if (!videoRef.current) {
      setError("Camera not initialized. Please try again.")
      return
    }

    try {
      const videoWidth = videoRef.current.videoWidth
      const videoHeight = videoRef.current.videoHeight

      setDebugInfo(`Video dimensions: ${videoWidth}x${videoHeight}`)

      if (!videoWidth || !videoHeight) {
        setError("Could not capture image. Please try again.")
        return
      }

      const canvas = document.createElement("canvas")
      canvas.width = videoWidth
      canvas.height = videoHeight
      const ctx = canvas.getContext("2d")

      if (!ctx) {
        setError("Failed to process camera image. Please try again.")
        return
      }

      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9)

      setDebugInfo("Image captured successfully")
      onImageCaptured(dataUrl)
      stopCamera()
    } catch (e) {
      setDebugInfo(`Error capturing: ${e.message || e}`)
      setError("Failed to capture image. Please try again.")
    }
  }

  return (
    <div className="space-y-4">
      {cameraActive ? (
        <>
          <div className="relative w-64 h-64 mx-auto overflow-hidden rounded-md border-2 border-primary">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
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
        </>
      ) : (
        <>
          <Button onClick={startCamera} className="w-full">
            <Camera className="h-4 w-4 mr-2" />
            Try Alternative Camera Method
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {debugInfo && (
            <div className="text-xs text-muted-foreground border p-2 rounded-md bg-muted">
              <p className="font-semibold">Debug Info:</p>
              <p>{debugInfo}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

