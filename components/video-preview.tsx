"use client"

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Download, Play, Pause, Volume2, VolumeX, Maximize2, Minimize2 } from 'lucide-react'

interface VideoPreviewProps {
  videoUrl?: string
  videoTitle?: string
  prompt?: string
  isGenerating?: boolean
  onDownload?: (videoUrl: string, filename: string) => void
}

const VideoPreview: React.FC<VideoPreviewProps> = ({
  videoUrl,
  videoTitle = "Generated Video",
  prompt,
  isGenerating = false,
  onDownload
}) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [videoRef, setVideoRef] = useState<HTMLVideoElement | null>(null)

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

  const handleDownload = () => {
    if (videoUrl && onDownload) {
      const filename = `${videoTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp4`
      onDownload(videoUrl, filename)
    }
  }

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
            className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full"
          />
          <span className="text-lg font-medium text-gray-800 dark:text-gray-200">
            🎬 Generating Video...
          </span>
        </div>
        
        {prompt && (
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Prompt:</p>
            <p className="text-gray-800 dark:text-gray-200 italic">"{prompt}"</p>
          </div>
        )}
        
        <div className="mt-4 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <motion.div
            className="bg-red-500 h-2 rounded-full"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 10, ease: "easeInOut" }}
          />
        </div>
        
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
          This may take a few minutes...
        </p>
      </motion.div>
    )
  }

  if (!videoUrl) {
    return (
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Play className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
            Video Generation Complete
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Video URL not available. This is a placeholder for VEO2 integration.
          </p>
        </div>
      </div>
    )
  }

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
        >
          <source src={videoUrl} type="video/mp4" />
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
          <span>MP4 • High Quality</span>
        </div>
      </div>
    </motion.div>
  )
}

export default VideoPreview 