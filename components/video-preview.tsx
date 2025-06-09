"use client"

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Download, Play, Pause, Volume2, VolumeX, Maximize2, Minimize2, AlertCircle, CheckCircle } from 'lucide-react'

interface VideoPreviewProps {
  videoUrl?: string
  videoTitle?: string
  prompt?: string
  isGenerating?: boolean
  operationName?: string
  apiKey?: string
  onDownload?: (videoUrl: string, filename: string) => void
  onError?: (error: string) => void
}

interface OperationStatus {
  operationName: string
  status: "processing" | "completed" | "failed"
  progress: number
  videoUrl?: string
  error?: string
  duration?: string
  createdAt?: string
  completedAt?: string
}

const VideoPreview: React.FC<VideoPreviewProps> = ({
  videoUrl: initialVideoUrl,
  videoTitle = "Generated Video",
  prompt,
  isGenerating = false,
  operationName,
  apiKey,
  onDownload,
  onError
}) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [videoRef, setVideoRef] = useState<HTMLVideoElement | null>(null)
  
  // Real-time operation tracking
  const [operationStatus, setOperationStatus] = useState<OperationStatus | null>(null)
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | undefined>(initialVideoUrl)
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Poll operation status for real VEO 2 operations
  const pollOperationStatus = async () => {
    if (!operationName || !apiKey || isPolling) return

    setIsPolling(true)

    try {
      const response = await fetch(`/api/veo2?operationName=${encodeURIComponent(operationName)}&apiKey=${encodeURIComponent(apiKey)}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || `Failed to check status: ${response.status}`)
      }

      if (result.success && result.data) {
        const status = result.data as OperationStatus
        setOperationStatus(status)

        if (status.status === "completed" && status.videoUrl) {
          setCurrentVideoUrl(status.videoUrl)
          setIsPolling(false)
        } else if (status.status === "failed") {
          setError(status.error || "Video generation failed")
          setIsPolling(false)
          onError?.(status.error || "Video generation failed")
        } else if (status.status === "processing") {
          // Continue polling
          setTimeout(pollOperationStatus, 5000) // Poll every 5 seconds
        }
      }
    } catch (err) {
      console.error("Error polling operation status:", err)
      setError(err instanceof Error ? err.message : "Failed to check video status")
      setIsPolling(false)
      onError?.(err instanceof Error ? err.message : "Failed to check video status")
    }
  }

  // Start polling when operationName is provided
  useEffect(() => {
    if (operationName && apiKey && !currentVideoUrl && !error) {
      pollOperationStatus()
    }
  }, [operationName, apiKey])

  const handlePlayPause = () => {
    if (videoRef) {
      if (isPlaying) {
        videoRef.pause()
      } else {
        videoRef.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleMuteToggle = () => {
    if (videoRef) {
      videoRef.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  const handleFullscreenToggle = () => {
    if (videoRef) {
      if (!isFullscreen) {
        videoRef.requestFullscreen?.()
      } else {
        document.exitFullscreen?.()
      }
      setIsFullscreen(!isFullscreen)
    }
  }

  const handleDownload = async () => {
    if (currentVideoUrl && onDownload) {
      const filename = `${videoTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp4`
      onDownload(currentVideoUrl, filename)
    } else if (currentVideoUrl) {
      // Fallback: direct download
      try {
        const response = await fetch(currentVideoUrl)
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${videoTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp4`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      } catch (err) {
        console.error("Download failed:", err)
      }
    }
  }

  // Show error state
  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-red-50 dark:bg-red-900/20 rounded-lg p-6 border border-red-200 dark:border-red-800"
      >
        <div className="flex items-center space-x-3 mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
          <span className="text-lg font-medium text-red-800 dark:text-red-200">
            Video Generation Failed
          </span>
        </div>
        
        <div className="text-center">
          <p className="text-sm text-red-700 dark:text-red-300 mb-2">Error:</p>
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
        
        {prompt && (
          <div className="mt-4 pt-4 border-t border-red-200 dark:border-red-800">
            <p className="text-sm text-red-600 dark:text-red-400 mb-2">Original Prompt:</p>
            <p className="text-red-800 dark:text-red-200 italic">"{prompt}"</p>
          </div>
        )}
      </motion.div>
    )
  }

  // Show processing state with real progress
  if (isGenerating || (operationStatus?.status === "processing" && !currentVideoUrl)) {
    const progress = operationStatus?.progress || 0
    const isRealOperation = operationName && apiKey

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
            className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full"
          />
          <span className="text-lg font-medium text-gray-800 dark:text-gray-200">
            {isRealOperation ? "🎬 Generating Video with VEO 2..." : "🎬 Generating Video..."}
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
            className="bg-red-500 h-3 rounded-full flex items-center justify-end pr-2"
            initial={{ width: "0%" }}
            animate={{ width: `${Math.max(progress, 10)}%` }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          >
            {progress > 20 && (
              <span className="text-xs text-white font-medium">
                {Math.round(progress)}%
              </span>
            )}
          </motion.div>
        </div>
        
        <div className="flex justify-between items-center mt-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {isRealOperation ? "Real-time generation via Google VEO 2 API" : "This may take a few minutes..."}
          </p>
          {operationStatus?.status === "processing" && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {Math.round(progress)}% complete
            </p>
          )}
        </div>

        {operationName && (
          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Operation ID:</p>
            <p className="text-xs font-mono text-gray-800 dark:text-gray-200 break-all">
              {operationName.split('/').pop()}
            </p>
          </div>
        )}
      </motion.div>
    )
  }

  // Show completion state without video
  if (!currentVideoUrl) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700"
      >
        <div className="text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
            Video Generation Complete
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {operationStatus?.status === "completed" 
              ? "Video has been generated successfully." 
              : "Video URL is being prepared..."}
          </p>
          
          {operationStatus?.completedAt && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Completed at: {new Date(operationStatus.completedAt).toLocaleString()}
            </p>
          )}
        </div>
      </motion.div>
    )
  }

  // Show video player
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700"
    >
      {/* Video Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">
              🎬 {videoTitle}
            </h3>
            {prompt && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Prompt: "{prompt}"
              </p>
            )}
            {operationStatus?.completedAt && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Generated: {new Date(operationStatus.completedAt).toLocaleString()}
              </p>
            )}
          </div>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
        </div>
      </div>

      {/* Video Player */}
      <div className="relative group">
        <video
          ref={setVideoRef}
          className="w-full aspect-video bg-black"
          controls={false}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          onError={() => setError("Failed to load video")}
        >
          <source src={currentVideoUrl} type="video/mp4" />
          Your browser does not support the video tag.
        </video>

        {/* Custom Controls Overlay */}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="flex items-center space-x-4">
            <button
              onClick={handlePlayPause}
              className="w-12 h-12 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 text-white" />
              ) : (
                <Play className="w-6 h-6 text-white ml-1" />
              )}
            </button>
          </div>
        </div>

        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <button
                onClick={handleMuteToggle}
                className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors"
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4 text-white" />
                ) : (
                  <Volume2 className="w-4 h-4 text-white" />
                )}
              </button>
            </div>
            
            <button
              onClick={handleFullscreenToggle}
              className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors"
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4 text-white" />
              ) : (
                <Maximize2 className="w-4 h-4 text-white" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Video Info */}
      <div className="p-4 bg-gray-50 dark:bg-gray-900/50">
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>Generated with VEO 2</span>
          <div className="flex items-center space-x-4">
            {operationStatus?.duration && (
              <span>{operationStatus.duration}</span>
            )}
            <span>MP4 • High Quality</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default VideoPreview 