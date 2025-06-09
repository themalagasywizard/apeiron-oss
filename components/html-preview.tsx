"use client"

import React, { useState, useRef } from 'react'
import { Download, Eye, EyeOff, Code, ExternalLink, Shield } from 'lucide-react'
import DOMPurify from 'isomorphic-dompurify'

type HTMLPreviewProps = {
  htmlContent: string
  filename?: string
  onDownload?: (content: string, filename: string) => void
}

export default function HTMLPreview({ htmlContent, filename = 'generated.html', onDownload }: HTMLPreviewProps) {
  const [showPreview, setShowPreview] = useState(false)
  const [showCode, setShowCode] = useState(true)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Sanitize HTML content for safe rendering
  const sanitizedContent = DOMPurify.sanitize(htmlContent, {
    ALLOWED_TAGS: [
      'html', 'head', 'title', 'meta', 'link', 'style', 'body',
      'header', 'nav', 'main', 'section', 'article', 'aside', 'footer',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'span',
      'a', 'ul', 'ol', 'li', 'img', 'figure', 'figcaption',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'form', 'input', 'textarea', 'button', 'select', 'option',
      'strong', 'em', 'br', 'hr', 'small', 'code', 'pre',
      'blockquote', 'cite', 'abbr', 'time', 'address'
    ],
    ALLOWED_ATTR: [
      'class', 'id', 'style', 'href', 'src', 'alt', 'title',
      'width', 'height', 'type', 'value', 'placeholder', 'name',
      'for', 'aria-label', 'aria-describedby', 'role'
    ],
    ALLOW_DATA_ATTR: false
  })

  const handleDownload = () => {
    if (onDownload) {
      onDownload(htmlContent, filename)
    } else {
      // Default download behavior
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
    const newWindow = window.open()
    if (newWindow) {
      newWindow.document.write(sanitizedContent)
      newWindow.document.close()
    }
  }

  const renderPreview = () => {
    if (iframeRef.current) {
      const iframe = iframeRef.current
      const doc = iframe.contentDocument || iframe.contentWindow?.document
      if (doc) {
        doc.open()
        doc.write(sanitizedContent)
        doc.close()
      }
    }
  }

  React.useEffect(() => {
    if (showPreview) {
      setTimeout(renderPreview, 100)
    }
  }, [showPreview, sanitizedContent])

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
            onClick={() => setShowCode(!showCode)}
            className="p-2 rounded-lg hover:bg-white/20 dark:hover:bg-gray-700/20 transition-colors"
            title="Toggle code view"
          >
            <Code className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
          
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="p-2 rounded-lg hover:bg-white/20 dark:hover:bg-gray-700/20 transition-colors"
            title="Toggle preview"
          >
            {showPreview ? (
              <EyeOff className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            ) : (
              <Eye className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            )}
          </button>
          
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

      {/* Content */}
      <div className="flex flex-col lg:flex-row">
        {/* Code View */}
        {showCode && (
          <div className="flex-1 min-h-[300px] max-h-[600px] overflow-auto">
            <pre className="p-4 text-sm text-gray-800 dark:text-gray-200 bg-gray-50/50 dark:bg-gray-900/50">
              <code>{htmlContent}</code>
            </pre>
          </div>
        )}
        
        {/* Preview */}
        {showPreview && (
          <div className={`${showCode ? 'flex-1' : 'w-full'} border-l border-gray-200/20 dark:border-gray-700/20`}>
            <div className="p-4 bg-gray-100/50 dark:bg-gray-800/50 border-b border-gray-200/20 dark:border-gray-700/20">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Live Preview</span>
            </div>
            <div className="relative min-h-[300px] max-h-[600px] overflow-auto bg-white">
              <iframe
                ref={iframeRef}
                className="w-full h-full min-h-[300px] border-none"
                title="HTML Preview"
                sandbox="allow-same-origin"
                style={{ backgroundColor: 'white' }}
              />
            </div>
          </div>
        )}
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