"use client"

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Download, Maximize2, Minimize2, Copy, ExternalLink, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react'

interface ImagePreviewProps {
  imageUrl?: string
  imageTitle?: string
  prompt?: string
  isGenerating?: boolean
  provider?: string
  model?: string
  aspectRatio?: string
  quality?: string
  onDownload?: (imageUrl: string, filename: string) => void
  onError?: (error: string) => void
}

const ImagePreview: React.FC<ImagePreviewProps> = ({
  imageUrl,
  imageTitle = "Generated Image",
  prompt,
  isGenerating = false,
  provider = "AI",
  model,
  aspectRatio,
  quality,
  onDownload,
  onError
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [showFullImage, setShowFullImage] = useState(false)

  const handleImageLoad = () => {
    setImageLoaded(true)
    setImageError(false)
  }

  const handleImageError = () => {
    setImageError(true)
    setImageLoaded(false)
    onError?.("Failed to load generated image")
  }

  const handleDownload = () => {
    if (imageUrl) {
      const filename = `${provider.toLowerCase()}-generated-${Date.now()}.png`
      
      // For data URLs (base64), create a download link
      if (imageUrl.startsWith('data:')) {
        const link = document.createElement('a')
        link.href = imageUrl
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } else {
        // For regular URLs, try to download via proxy or direct link
        onDownload?.(imageUrl, filename)
      }
    }
  }

  const handleCopyUrl = async () => {
    if (imageUrl) {
      try {
        await navigator.clipboard.writeText(imageUrl)
        // Could add a toast notification here
      } catch (err) {
        console.error('Failed to copy URL:', err)
      }
    }
  }

  const handleFullscreenToggle = () => {
    setIsFullscreen(!isFullscreen)
  }

  // Show generating state
  if (isGenerating) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700"
      >
        <div className="flex items-center justify-center space-x-3 mb-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"
          />
          <span className="text-lg font-medium text-gray-800 dark:text-gray-200">
            🎨 Generating Image...
          </span>
        </div>
        
        {prompt && (
          <div className="text-center mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Prompt:</p>
            <p className="text-gray-800 dark:text-gray-200 italic">"{prompt}"</p>
          </div>
        )}
        
        <div className="mt-4 bg-gray-200 dark:bg-gray-700 rounded-full h-3">
          <motion.div
            className="bg-blue-500 h-3 rounded-full"
            initial={{ width: "0%" }}
            animate={{ width: "70%" }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        
        <div className="text-center mt-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Creating your image with {provider}...
          </p>
        </div>
      </motion.div>
    )
  }

  // Show error state
  if (imageError || (!imageUrl && !isGenerating)) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg p-6 border bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
      >
        <div className="flex items-center space-x-3 mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
          <span className="text-lg font-medium text-red-800 dark:text-red-200">
            Image Generation Failed
          </span>
        </div>
        
        <p className="text-red-600 dark:text-red-400 mb-4">
          Unable to generate or load the image. This could be due to content filters, API limits, or network issues.
        </p>
        
        {prompt && (
          <div className="mt-4 pt-4 border-t border-red-200 dark:border-red-800">
            <p className="text-sm mb-2 text-red-600 dark:text-red-400">
              Original Prompt:
            </p>
            <p className="italic text-red-800 dark:text-red-200">
              "{prompt}"
            </p>
          </div>
        )}
      </motion.div>
    )
  }

  // Show image
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700"
    >
      {/* Image Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">
              🎨 {imageTitle}
            </h3>
            {prompt && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Prompt: "{prompt}"
              </p>
            )}
            <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
              <span>Generated with {provider}</span>
              {model && <span>Model: {model}</span>}
              {aspectRatio && <span>Ratio: {aspectRatio}</span>}
              {quality && <span>Quality: {quality}</span>}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopyUrl}
              className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              title="Copy image URL"
            >
              <Copy className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
            
            <button
              onClick={handleDownload}
              className="p-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors"
              title="Download image"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Image Display */}
      <div className="relative group">
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-gray-700">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full"
            />
          </div>
        )}
        
        <img
          src={imageUrl}
          alt={prompt || "Generated image"}
          className={`w-full h-auto max-h-96 object-contain bg-black/5 dark:bg-white/5 transition-opacity ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
        
        {/* Image Controls Overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowFullImage(true)}
              className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors"
              title="View full size"
            >
              <Eye className="w-5 h-5 text-white" />
            </button>
            
            <button
              onClick={handleFullscreenToggle}
              className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors"
              title="Toggle fullscreen"
            >
              {isFullscreen ? (
                <Minimize2 className="w-5 h-5 text-white" />
              ) : (
                <Maximize2 className="w-5 h-5 text-white" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Image Info */}
      <div className="p-4 bg-gray-50 dark:bg-gray-900/50">
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
          <span>Generated with {provider}</span>
          <div className="flex items-center space-x-4">
            <span>PNG • High Quality</span>
            <span>{new Date().toLocaleTimeString()}</span>
          </div>
        </div>
        
        {/* Download instructions */}
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-green-50 dark:bg-green-900/20 rounded-lg p-2 border border-green-200 dark:border-green-800">
          <Download className="w-3 h-3 text-green-500" />
          <span>
            💡 <strong>Easy Download:</strong> Click the download button above or right-click the image and select "Save image as..."
          </span>
        </div>
      </div>

      {/* Full Size Modal */}
      {showFullImage && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowFullImage(false)}
        >
          <div className="relative max-w-full max-h-full">
            <img
              src={imageUrl}
              alt={prompt || "Generated image"}
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setShowFullImage(false)}
              className="absolute top-4 right-4 w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-colors"
            >
              <EyeOff className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  )
}

export default ImagePreview 