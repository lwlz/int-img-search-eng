"use client"

import { memo, useState } from "react"

interface ImageGridProps {
  images: Array<{
    id: string
    dataUrl: string
    similarity?: number
    metrics?: {
      cosine?: number
      euclidean?: number
      manhattan?: number
      color?: number
      visualProps?: number
      text?: number
    }
    timestamp?: string
    metadata?: {
      dominantColors?: string[]
      brightness?: number
      contrast?: number
    }
    textContent?: {
      text: string
      confidence: number
      words: Array<{
        text: string
        confidence: number
      }>
    }
    hasSignificantText?: boolean
  }>
  showSimilarity?: boolean
  selectable?: boolean
  selectedIds?: Set<string>
  onImageSelect?: (id: string) => void
}

// Memoized image component for better performance
const ImageItem = memo(
  ({
    image,
    showSimilarity,
    selectable,
    isSelected,
    onSelect,
  }: {
    image: ImageGridProps["images"][0]
    showSimilarity: boolean
    selectable: boolean
    isSelected: boolean
    onSelect?: () => void
  }) => {
    const [imageLoaded, setImageLoaded] = useState(false)
    const [showDetails, setShowDetails] = useState(false)

    const formatDate = (timestamp: string) => {
      if (!timestamp) return ""
      const date = new Date(timestamp)
      return date.toLocaleString()
    }

    // Format similarity score with color coding
    const getSimilarityColor = (similarity: number) => {
      if (similarity > 0.85) return "text-green-500"
      if (similarity > 0.7) return "text-yellow-500"
      if (similarity > 0.5) return "text-orange-500"
      return "text-red-500"
    }

    return (
      <div
        className={`relative aspect-square overflow-hidden rounded-md border transition-all ${
          selectable ? "cursor-pointer hover:opacity-90" : ""
        } ${isSelected ? "ring-2 ring-primary ring-offset-2" : ""}`}
        onClick={onSelect}
        onMouseEnter={() => showSimilarity && setShowDetails(true)}
        onMouseLeave={() => showSimilarity && setShowDetails(false)}
      >
        {/* Loading placeholder */}
        {!imageLoaded && (
          <div className="absolute inset-0 bg-muted flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        <img
          src={image.dataUrl || "/placeholder.svg"}
          alt={`Image ${image.id}`}
          className={`w-full h-full object-cover ${imageLoaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setImageLoaded(true)}
          loading="lazy"
        />

        {/* Text indicator */}
        {image.textContent?.text && !showSimilarity && (
          <div className="absolute top-2 left-2 bg-black/50 text-white text-xs p-1 rounded-md flex items-center gap-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3 w-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <span>Text</span>
          </div>
        )}

        {showSimilarity && image.similarity !== undefined && (
          <div
            className={`absolute bottom-0 left-0 right-0 bg-black/70 text-white p-2 flex flex-col gap-1 transition-all ${
              showDetails ? "h-auto" : "h-8"
            }`}
          >
            <div className="flex justify-between items-center">
              <div className="text-xs font-medium">
                <span className={getSimilarityColor(image.similarity)}>{Math.round(image.similarity * 100)}%</span>
                {image.hasSignificantText && (
                  <span className="ml-1 bg-blue-500 text-white text-[0.6rem] px-1 py-0.5 rounded">TEXT</span>
                )}
              </div>
              <div className="w-1/2 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    image.similarity > 0.85
                      ? "bg-green-500"
                      : image.similarity > 0.7
                        ? "bg-yellow-500"
                        : image.similarity > 0.5
                          ? "bg-orange-500"
                          : "bg-red-500"
                  }`}
                  style={{ width: `${Math.round(image.similarity * 100)}%` }}
                ></div>
              </div>
            </div>

            {showDetails && image.metrics && (
              <>
                <div className="grid grid-cols-6 gap-1 text-[0.6rem] text-gray-300 mt-1">
                  {image.metrics.cosine !== undefined && (
                    <div className="flex flex-col items-center">
                      <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${Math.round(image.metrics.cosine * 100)}%` }}
                        ></div>
                      </div>
                      <span>Vec</span>
                    </div>
                  )}
                  {image.metrics.euclidean !== undefined && (
                    <div className="flex flex-col items-center">
                      <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500"
                          style={{ width: `${Math.round(image.metrics.euclidean * 100)}%` }}
                        ></div>
                      </div>
                      <span>Dist</span>
                    </div>
                  )}
                  {image.metrics.manhattan !== undefined && (
                    <div className="flex flex-col items-center">
                      <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500"
                          style={{ width: `${Math.round(image.metrics.manhattan * 100)}%` }}
                        ></div>
                      </div>
                      <span>Man</span>
                    </div>
                  )}
                  {image.metrics.color !== undefined && (
                    <div className="flex flex-col items-center">
                      <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-pink-500"
                          style={{ width: `${Math.round(image.metrics.color * 100)}%` }}
                        ></div>
                      </div>
                      <span>Color</span>
                    </div>
                  )}
                  {image.metrics.visualProps !== undefined && (
                    <div className="flex flex-col items-center">
                      <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-500"
                          style={{ width: `${Math.round(image.metrics.visualProps * 100)}%` }}
                        ></div>
                      </div>
                      <span>Vis</span>
                    </div>
                  )}
                  {image.metrics.text !== undefined && (
                    <div className="flex flex-col items-center">
                      <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500"
                          style={{ width: `${Math.round(image.metrics.text * 100)}%` }}
                        ></div>
                      </div>
                      <span>Text</span>
                    </div>
                  )}
                </div>

                {/* Show text preview if there's a text match */}
                {image.textContent?.text && image.metrics?.text && image.metrics.text > 0.3 && (
                  <div className="mt-1 text-[0.65rem] bg-black/30 p-1 rounded text-left truncate">
                    "{image.textContent.text.substring(0, 40)}
                    {image.textContent.text.length > 40 ? "..." : ""}"
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {image.timestamp && !showSimilarity && (
          <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1">
            {formatDate(image.timestamp)}
          </div>
        )}

        {selectable && isSelected && (
          <div className="absolute top-2 right-2 h-5 w-5 bg-primary rounded-full flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3 w-3 text-white"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}

        {image.metadata?.dominantColors && image.metadata.dominantColors.length > 0 && !showSimilarity && (
          <div className="absolute top-0 left-0 right-0 flex h-1">
            {image.metadata.dominantColors.slice(0, 5).map((color, i) => (
              <div
                key={i}
                className="h-full"
                style={{
                  backgroundColor: color,
                  width: `${100 / image.metadata.dominantColors.length}%`,
                }}
              />
            ))}
          </div>
        )}
      </div>
    )
  },
)

ImageItem.displayName = "ImageItem"

// Main component with virtualization for large datasets
const ImageGrid = ({
  images,
  showSimilarity = false,
  selectable = false,
  selectedIds = new Set(),
  onImageSelect,
}: ImageGridProps) => {
  if (!images || images.length === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {images.map((image) => (
        <ImageItem
          key={image.id}
          image={image}
          showSimilarity={showSimilarity}
          selectable={selectable}
          isSelected={selectedIds.has(image.id)}
          onSelect={() => selectable && onImageSelect && onImageSelect(image.id)}
        />
      ))}
    </div>
  )
}

export default memo(ImageGrid)

