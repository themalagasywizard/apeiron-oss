"use client"

import React, { useState, useEffect, useRef } from 'react'
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
  
  // Add ref to track polling timeout for cleanup
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Real-time operation tracking
  const [operationStatus, setOperationStatus] = useState<OperationStatus | null>(null)
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | undefined>(initialVideoUrl)
  const [authenticatedVideoUrl, setAuthenticatedVideoUrl] = useState<string | undefined>(initialVideoUrl)
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoadingVideo, setIsLoadingVideo] = useState(false)

  // Create authenticated blob URL for video playback
  const createAuthenticatedVideoUrl = async (videoUrl: string) => {
    if (!apiKey) {
      console.log("No API key available for authenticated video loading - using direct URL");
      setAuthenticatedVideoUrl(videoUrl);
      return;
    }

    try {
      setIsLoadingVideo(true);
      console.log("Creating authenticated video URL via proxy...");
      console.log("Input video URL:", videoUrl);
      
      // Use our video proxy endpoint to handle authentication
      // Add timestamp to prevent browser caching of different videos
      const timestamp = Date.now();
      const proxyUrl = `/api/video-proxy?url=${encodeURIComponent(videoUrl)}&key=${encodeURIComponent(apiKey)}&t=${timestamp}`;
      console.log("Using proxy URL:", proxyUrl);
      
      setAuthenticatedVideoUrl(proxyUrl);
      
      console.log("Proxy video URL set successfully:", proxyUrl);
      console.log("Component should now show video player with authenticated access");
    } catch (err) {
      console.error("Failed to create authenticated video URL:", err);
      // Fallback to original URL
      setAuthenticatedVideoUrl(videoUrl);
    } finally {
      setIsLoadingVideo(false);
      console.log("Video loading state set to false");
    }
  }

  // Poll operation status for real VEO 2 operations
  const pollOperationStatus = async () => {
    if (!operationName || !apiKey) {
      console.log("Polling skipped: missing operationName or apiKey");
      return
    }

    if (isPolling) {
      console.log("Polling already in progress, skipping");
      return;
    }

    setIsPolling(true);
    console.log("=== Starting VEO 2 Status Poll ===");
    console.log("Operation Name:", operationName);
    console.log("API Key:", apiKey ? `${apiKey.substring(0, 10)}...` : "not provided");
    console.log("Current Video URL:", currentVideoUrl);
    console.log("Current Error:", error);

    try {
      const url = `/api/veo2?operationName=${encodeURIComponent(operationName)}&apiKey=${encodeURIComponent(apiKey)}`
      console.log("Making status request to:", url);
      
      const response = await fetch(url)
      const result = await response.json()

      console.log("Status poll response status:", response.status);
      console.log("Status poll result:", JSON.stringify(result, null, 2));

      if (!response.ok) {
        console.error("Status poll failed:", response.status, result);
        throw new Error(result.error || `Failed to check status: ${response.status}`)
      }

      if (result.success && result.data) {
        const status = result.data as OperationStatus
        console.log("Setting operation status:", status);
        setOperationStatus(status)

        if (status.status === "completed" && status.videoUrl) {
          console.log("Video generation completed! URL:", status.videoUrl);
          console.log("Setting currentVideoUrl to:", status.videoUrl);
          setCurrentVideoUrl(status.videoUrl)
          setIsPolling(false)
          // Create authenticated video URL for playback
          createAuthenticatedVideoUrl(status.videoUrl)
          console.log("Video state updated - should transition to video player")
        } else if (status.status === "failed") {
          console.log("Video generation failed:", status.error);
          setError(status.error || "Video generation failed")
          setIsPolling(false)
          onError?.(status.error || "Video generation failed")
        } else if (status.status === "processing") {
          console.log("Video still processing, progress:", status.progress, "%. Continuing to poll...");
          // Continue polling
          setIsPolling(false); // Reset polling state so next poll can start
          pollingTimeoutRef.current = setTimeout(() => {
            console.log("Scheduling next poll in 5 seconds...");
            pollOperationStatus();
          }, 5000) // Poll every 5 seconds
        }
      } else {
        console.error("Invalid response format:", result);
        setIsPolling(false);
        throw new Error("Invalid response format from status endpoint");
      }
    } catch (err) {
      console.error("Error polling operation status:", err)
      setError(err instanceof Error ? err.message : "Failed to check video status")
      setIsPolling(false)
      onError?.(err instanceof Error ? err.message : "Failed to check video status")
    }
    
    console.log("=== End Status Poll ===");
  }

  // Update currentVideoUrl when initialVideoUrl prop changes
  useEffect(() => {
    console.log("VideoPreview: initialVideoUrl prop changed:", initialVideoUrl);
    console.log("VideoPreview: current currentVideoUrl state:", currentVideoUrl);
    
    if (initialVideoUrl !== currentVideoUrl) {
      console.log("VideoPreview: Updating currentVideoUrl to match new prop");
      setCurrentVideoUrl(initialVideoUrl);
      
      // Reset related state when video URL changes
      setError(null);
      setIsLoadingVideo(false);
      
      if (initialVideoUrl) {
        // Also create authenticated URL for immediate playback
        createAuthenticatedVideoUrl(initialVideoUrl);
      } else {
        setAuthenticatedVideoUrl(undefined);
      }
    }
  }, [initialVideoUrl]);

  // Reset operation state when operationName changes
  useEffect(() => {
    console.log("VideoPreview: operationName prop changed:", operationName);
    
    // Reset operation-specific state when switching operations
    if (operationName) {
      setOperationStatus(null);
      setIsPolling(false);
      setError(null);
      console.log("VideoPreview: Reset operation state for new operation");
    }
  }, [operationName]);

  // Start polling when operationName is provided
  useEffect(() => {
    console.log("useEffect triggered - checking if should start polling");
    console.log("operationName:", operationName);
    console.log("apiKey:", apiKey ? "present" : "missing");
    console.log("currentVideoUrl:", currentVideoUrl);
    console.log("error:", error);
    console.log("isPolling:", isPolling);

    if (operationName && apiKey && !currentVideoUrl && !error && !isPolling) {
      console.log("Starting initial poll for operation:", operationName);
      // Add a small delay to prevent race conditions
      setTimeout(() => {
        pollOperationStatus()
      }, 100);
    } else {
      console.log("Polling conditions not met, skipping");
    }
  }, [operationName, apiKey, currentVideoUrl, error])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      console.log("VideoPreview component unmounting, cleaning up polling for:", operationName);
      setIsPolling(false);
      // Clear any pending timeout
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }
    };
  }, [operationName])

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
      // Try multiple download strategies for better compatibility
      try {
        console.log("Attempting video download...");
        
        // Strategy 1: Try authenticated download via proxy if API key is available
        if (apiKey) {
          console.log("Trying authenticated download via proxy...");
          const timestamp = Date.now();
          const proxyUrl = `/api/video-proxy?url=${encodeURIComponent(currentVideoUrl)}&key=${encodeURIComponent(apiKey)}&t=${timestamp}`;
          
          const response = await fetch(proxyUrl);
          
          if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${videoTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            console.log("Download completed successfully via proxy");
            return;
          } else {
            // Try to get better error message from proxy
            try {
              const errorData = await response.json();
              if (errorData.message) {
                console.log("Proxy error:", errorData.message);
                // Show user-friendly error message
                alert(errorData.message);
                return; // Don't try other methods if we have a clear error message
              }
            } catch (parseError) {
              // Continue with other methods if we can't parse the error
            }
            console.log("Proxy download failed, trying direct methods...");
          }
        }
        
        // Strategy 2: Try direct fetch (for publicly accessible URLs)
        console.log("Trying direct fetch download...");
        try {
          const response = await fetch(currentVideoUrl, {
            mode: 'cors',
            credentials: 'omit'
          });
          
          if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${videoTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            console.log("Download completed successfully via direct fetch");
            return;
          }
        } catch (directFetchError) {
          console.log("Direct fetch failed:", directFetchError);
        }
        
        // Strategy 3: Open in new tab as fallback
        console.log("Using fallback: opening video in new tab...");
        const link = document.createElement('a');
        link.href = currentVideoUrl;
        link.target = '_blank';
        link.download = `${videoTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
      } catch (err) {
        console.error("All download strategies failed:", err);
        // Final fallback: copy URL to clipboard and show user message
        try {
          await navigator.clipboard.writeText(currentVideoUrl);
          alert('Download failed, but the video URL has been copied to your clipboard. You can paste it in your browser to access the video.');
        } catch (clipboardErr) {
          console.error("Clipboard access failed:", clipboardErr);
          alert(`Download failed. Please copy this URL manually: ${currentVideoUrl}`);
        }
      }
    }
  }

  // Show error state
  if (error) {
    const isContentFiltered = error.includes("blocked by Google's safety filters") || 
                              error.includes("safety filters") ||
                              error.includes("content policy");
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-lg p-6 border ${
          isContentFiltered 
            ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        }`}
      >
        <div className="flex items-center space-x-3 mb-4">
          <AlertCircle className={`w-8 h-8 ${isContentFiltered ? 'text-orange-500' : 'text-red-500'}`} />
          <span className={`text-lg font-medium ${
            isContentFiltered 
              ? 'text-orange-800 dark:text-orange-200'
              : 'text-red-800 dark:text-red-200'
          }`}>
            {isContentFiltered ? '🛡️ Content Filtered' : 'Video Generation Failed'}
          </span>
        </div>
        
        <div className="text-center">
          <p className={`text-sm mb-2 ${
            isContentFiltered 
              ? 'text-orange-700 dark:text-orange-300'
              : 'text-red-700 dark:text-red-300'
          }`}>
            {isContentFiltered ? 'Safety Notice:' : 'Error:'}
          </p>
          <p className={`${
            isContentFiltered 
              ? 'text-orange-800 dark:text-orange-200'
              : 'text-red-800 dark:text-red-200'
          }`}>
            {error}
          </p>
        </div>
        
        {isContentFiltered && (
          <div className="mt-4 p-4 bg-orange-100 dark:bg-orange-900/30 rounded-lg border border-orange-200 dark:border-orange-800">
            <h4 className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">
              💡 Suggestions to fix this:
            </h4>
            <ul className="text-sm text-orange-700 dark:text-orange-300 space-y-1 list-disc list-inside">
              <li>Avoid references to copyrighted characters, brands, or media</li>
              <li>Remove potentially sensitive or inappropriate content</li>
              <li>Use more general, descriptive language</li>
              <li>Focus on actions, scenes, and visual elements rather than specific people or brands</li>
            </ul>
          </div>
        )}
        
        {prompt && (
          <div className={`mt-4 pt-4 border-t ${
            isContentFiltered 
              ? 'border-orange-200 dark:border-orange-800'
              : 'border-red-200 dark:border-red-800'
          }`}>
            <p className={`text-sm mb-2 ${
              isContentFiltered 
                ? 'text-orange-600 dark:text-orange-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              Original Prompt:
            </p>
            <p className={`italic ${
              isContentFiltered 
                ? 'text-orange-800 dark:text-orange-200'
                : 'text-red-800 dark:text-red-200'
            }`}>
              "{prompt}"
            </p>
          </div>
        )}
        
        {isContentFiltered && (
          <div className="mt-4 text-center">
            <p className="text-xs text-orange-600 dark:text-orange-400">
              Try rephrasing your prompt to avoid content that might trigger safety filters
            </p>
          </div>
        )}
      </motion.div>
    )
  }

  // Show processing state with real progress (only if no video URL available)
  if ((isGenerating || operationStatus?.status === "processing") && !currentVideoUrl && !authenticatedVideoUrl) {
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

        {/* Manual status check button for debugging */}
        {isRealOperation && (
          <div className="mt-4 text-center">
            <button
              onClick={() => {
                console.log("Manual status check triggered");
                pollOperationStatus();
              }}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors"
            >
              Check Status Now
            </button>
          </div>
        )}
      </motion.div>
    )
  }

  // Debug: Log current state for troubleshooting
  console.log("VideoPreview Render State:", {
    isGenerating,
    operationStatus: operationStatus?.status,
    currentVideoUrl: currentVideoUrl ? `${currentVideoUrl.substring(0, 50)}...` : "null",
    authenticatedVideoUrl: authenticatedVideoUrl ? `${authenticatedVideoUrl.substring(0, 50)}...` : "null",
    error,
    isPolling
  });

  // Show completion state without video
  if (!currentVideoUrl && !authenticatedVideoUrl) {
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
  console.log("🎬 RENDERING VIDEO PLAYER - Video URL available!");
  console.log("Using video URL:", authenticatedVideoUrl || currentVideoUrl);
  
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
        {isLoadingVideo ? (
          <div className="w-full aspect-video bg-black flex items-center justify-center">
            <div className="text-white text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-8 h-8 border-4 border-white border-t-transparent rounded-full mx-auto mb-2"
              />
              <p className="text-sm">Loading video...</p>
            </div>
          </div>
        ) : (
          <video
            key={authenticatedVideoUrl || currentVideoUrl} // Force re-render when URL changes
            ref={setVideoRef}
            className="w-full aspect-video bg-black"
            controls={false}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            onError={(e) => {
              console.error("Video loading error:", e);
              console.log("Failed video URL:", authenticatedVideoUrl || currentVideoUrl);
              setError("Failed to load video. Try using the download button instead.");
            }}
            crossOrigin="anonymous"
          >
            <source src={authenticatedVideoUrl || currentVideoUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        )}

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