"use client"

import { useState, useEffect } from "react"
import { getAllImages } from "@/lib/db"
import ImageGrid from "@/components/image-grid"
import { Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { deleteImage, clearAllImages } from "@/lib/db"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export default function GalleryView() {
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set())
  const [isSelectionMode, setIsSelectionMode] = useState(false)

  const loadImages = async () => {
    setLoading(true)
    try {
      const allImages = await getAllImages()
      // Sort by timestamp, newest first
      allImages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      setImages(allImages)
    } catch (error) {
      console.error("Error loading images:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadImages()
  }, [])

  const handleImageSelect = (id: string) => {
    if (!isSelectionMode) return

    setSelectedImages((prev) => {
      const newSelection = new Set(prev)
      if (newSelection.has(id)) {
        newSelection.delete(id)
      } else {
        newSelection.add(id)
      }
      return newSelection
    })
  }

  const handleDeleteSelected = async () => {
    try {
      setLoading(true)
      for (const id of selectedImages) {
        await deleteImage(id)
      }
      setSelectedImages(new Set())
      setIsSelectionMode(false)
      await loadImages()
    } catch (error) {
      console.error("Error deleting images:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleClearAll = async () => {
    try {
      setLoading(true)
      await clearAllImages()
      await loadImages()
    } catch (error) {
      console.error("Error clearing database:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Image Gallery</h2>
        <p className="text-muted-foreground">View all images in your database</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      ) : images.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground">No images in database</p>
          <p className="text-sm text-muted-foreground mt-2">Upload some images to get started</p>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center mb-4">
            <div className="text-sm text-muted-foreground">
              {images.length} image{images.length !== 1 ? "s" : ""} in database
            </div>
            <div className="flex gap-2">
              <Button
                variant={isSelectionMode ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setIsSelectionMode(!isSelectionMode)
                  setSelectedImages(new Set())
                }}
              >
                {isSelectionMode ? "Cancel Selection" : "Select Images"}
              </Button>

              {isSelectionMode && selectedImages.size > 0 && (
                <Button variant="destructive" size="sm" onClick={handleDeleteSelected}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete Selected ({selectedImages.size})
                </Button>
              )}

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Trash2 className="h-4 w-4 mr-1" />
                    Clear All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear all images?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will delete all {images.length} images from your database. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearAll}>Delete All</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <ImageGrid
            images={images}
            selectable={isSelectionMode}
            selectedIds={selectedImages}
            onImageSelect={handleImageSelect}
          />
        </>
      )}
    </div>
  )
}

