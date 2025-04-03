"use client"

import { useState } from "react"
import ImageGrid from "@/components/image-grid"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp } from "lucide-react"

interface CategorizedResultsProps {
  results: Array<{
    id: string
    dataUrl: string
    similarity: number
    metrics?: {
      cosine?: number
      euclidean?: number
      manhattan?: number
      color?: number
      visualProps?: number
      text?: number
    }
    hasSignificantText?: boolean
    textContent?: {
      text: string
      confidence: number
      words: Array<{
        text: string
        confidence: number
      }>
    }
  }>
}

export default function CategorizedResults({ results }: CategorizedResultsProps) {
  const [showAllPotentialMatches, setShowAllPotentialMatches] = useState(false)

  // Split results into accurate matches (>=80%) and potential matches (<80%)
  const accurateMatches = results.filter((result) => result.similarity >= 0.8)
  const potentialMatches = results.filter((result) => result.similarity < 0.8)

  // Limit the number of potential matches shown initially
  const initialPotentialMatchCount = 4
  const displayedPotentialMatches = showAllPotentialMatches
    ? potentialMatches
    : potentialMatches.slice(0, initialPotentialMatchCount)

  return (
    <div className="space-y-8">
      {/* Accurate Matches Section */}
      {accurateMatches.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-xl font-semibold">Accurate Matches</h2>
            <div className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
              {accurateMatches.length} result{accurateMatches.length !== 1 ? "s" : ""}
            </div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <ImageGrid images={accurateMatches} showSimilarity={true} />
          </div>
        </div>
      )}

      {/* Potential Matches Section */}
      {potentialMatches.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-xl font-semibold">May Correspond</h2>
            <div className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
              {potentialMatches.length} result{potentialMatches.length !== 1 ? "s" : ""}
            </div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <ImageGrid images={displayedPotentialMatches} showSimilarity={true} />

            {/* Show more/less button */}
            {potentialMatches.length > initialPotentialMatchCount && (
              <div className="mt-4 text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllPotentialMatches(!showAllPotentialMatches)}
                  className="text-sm"
                >
                  {showAllPotentialMatches ? (
                    <span className="flex items-center gap-1">
                      <ChevronUp className="h-4 w-4" />
                      Show fewer results
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <ChevronDown className="h-4 w-4" />
                      Show {potentialMatches.length - initialPotentialMatchCount} more results
                    </span>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* No matches in either category */}
      {accurateMatches.length === 0 && potentialMatches.length === 0 && (
        <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-muted-foreground">No matching images found</p>
        </div>
      )}
    </div>
  )
}

