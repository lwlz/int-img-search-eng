"use client"

import { useState, useEffect, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import UploadForm from "@/components/upload-form"
import SearchForm from "@/components/search-form"
import GalleryView from "@/components/gallery-view"
import { initDB, closeDB } from "@/lib/db"
import { loadModel } from "@/lib/embedding"
import { initOCR, terminateOCR } from "@/lib/text-recognition"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"
import CategorizedResults from "@/components/categorized-results"

export default function Home() {
  const [searchResults, setSearchResults] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [modelLoading, setModelLoading] = useState(true)
  const [modelError, setModelError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("upload")

  // Memoized search results handler for better performance
  const handleSearchResults = useCallback((results: any[]) => {
    setSearchResults(results)
  }, [])

  // Initialize the database, load the model, and initialize OCR when the component mounts
  useEffect(() => {
    let mounted = true

    const init = async () => {
      try {
        // Load models in parallel with Promise.all for better performance
        await Promise.all([initDB(), loadModel(), initOCR()])

        if (mounted) {
          setModelLoading(false)
        }
      } catch (error) {
        console.error("Initialization error:", error)
        if (mounted) {
          setModelError("Failed to load the required models. Please check your connection and try again.")
          setModelLoading(false)
        }
      }
    }

    init()

    // Clean up resources when component unmounts
    return () => {
      mounted = false
      closeDB()
      terminateOCR()
    }
  }, [])

  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value)

    // Clear search results when switching away from search tab
    if (value !== "search") {
      setSearchResults([])
    }
  }

  return (
    <main className="container mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6 text-center">Vector Image Search Engine</h1>

      {modelLoading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading image recognition models...</p>
        </div>
      ) : modelError ? (
        <Alert variant="destructive" className="max-w-md mx-auto">
          <AlertDescription>{modelError}</AlertDescription>
        </Alert>
      ) : (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="max-w-3xl mx-auto">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="upload">Upload Images</TabsTrigger>
            <TabsTrigger value="search">Search Images</TabsTrigger>
            <TabsTrigger value="gallery">Gallery</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="p-4 border rounded-lg">
            <UploadForm />
          </TabsContent>

          <TabsContent value="search" className="p-4 border rounded-lg">
            <SearchForm onSearchResults={handleSearchResults} setIsLoading={setIsLoading} />

            {isLoading ? (
              <div className="flex justify-center my-8">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
            ) : (
              searchResults.length > 0 && (
                <div className="mt-8 space-y-6">
                  <CategorizedResults results={searchResults} />
                </div>
              )
            )}
          </TabsContent>

          <TabsContent value="gallery" className="p-4 border rounded-lg">
            <GalleryView />
          </TabsContent>
        </Tabs>
      )}
    </main>
  )
}

