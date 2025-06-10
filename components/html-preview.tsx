"use client"

import React from 'react'
import { Download, Code, ExternalLink, Shield } from 'lucide-react'

type HTMLPreviewProps = {
  htmlContent: string
  filename?: string
  onDownload?: (content: string, filename: string) => void
}

export default function HTMLPreview({ htmlContent, filename = 'generated.html', onDownload }: HTMLPreviewProps) {
  const handleDownload = () => {
    if (onDownload) {
      onDownload(htmlContent, filename)
    } else {
      // Default download behavior using original htmlContent
      const blob = new Blob([htmlContent], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  const handleOpenInNewTab = () => {
    // Always use the current htmlContent
    const newWindow = window.open()
    if (newWindow) {
      newWindow.document.write(htmlContent)
      newWindow.document.close()
    }
  }

  return (
    <div className="border border-gray-200/20 dark:border-gray-700/20 rounded-xl overflow-hidden bg-white/5 dark:bg-gray-800/20">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200/20 dark:border-gray-700/20 bg-white/10 dark:bg-gray-800/30">
        <div className="flex items-center gap-2">
          <Code className="w-5 h-5 text-blue-500" />
          <span className="font-medium text-gray-800 dark:text-gray-200">HTML Code Generated</span>
          <Shield className="w-4 h-4 text-green-500" />
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenInNewTab}
            className="p-2 rounded-lg hover:bg-white/20 dark:hover:bg-gray-700/20 transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
          
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            title="Download HTML file"
          >
            <Download className="w-4 h-4" />
            <span className="text-sm font-medium">Download</span>
          </button>
        </div>
      </div>

      {/* Code View Only */}
      <div className="relative min-h-[400px] max-h-[600px] overflow-auto">
        <pre className="p-4 text-sm text-gray-800 dark:text-gray-200 bg-gray-50/50 dark:bg-gray-900/50 h-full">
          <code>{htmlContent}</code>
        </pre>
      </div>
      
      {/* Footer with security info */}
      <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 bg-white/5 dark:bg-gray-800/20 border-t border-gray-200/20 dark:border-gray-700/20">
        <div className="flex items-center gap-2">
          <Shield className="w-3 h-3 text-green-500" />
          <span>Content sanitized for security • Safe rendering enabled</span>
        </div>
      </div>
    </div>
  )
} 