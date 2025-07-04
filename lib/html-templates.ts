// HTML Template Generators for AI Chat Platform

export interface HTMLTemplateOptions {
  title?: string
  description?: string
  theme?: 'light' | 'dark' | 'auto'
  includeBootstrap?: boolean
  includeTailwind?: boolean
  customCSS?: string
  lang?: string
}

export interface NavigationItem {
  label: string
  href: string
  isActive?: boolean
}

export interface AlertOptions {
  type: 'success' | 'warning' | 'error' | 'info'
  title?: string
  message: string
  dismissible?: boolean
}

// Base HTML template
export function generateBaseHTML(options: HTMLTemplateOptions = {}): string {
  const {
    title = 'Generated HTML Page',
    description = 'Generated by AI Chat Platform',
    theme = 'auto',
    includeBootstrap = false,
    includeTailwind = true,
    customCSS = '',
    lang = 'en'
  } = options

  const bootstrapCDN = includeBootstrap ? 
    '<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">' : ''
  
  const tailwindCDN = includeTailwind ? 
    '<script src="https://cdn.tailwindcss.com"></script>' : ''

  const themeScript = theme === 'auto' ? `
    <script>
      // Auto theme detection
      if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    </script>` : ''

  return `<!DOCTYPE html>
<html lang="${lang}" class="${theme === 'dark' ? 'dark' : ''}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${description}">
    <title>${title}</title>
    ${bootstrapCDN}
    ${tailwindCDN}
    <style>
        /* Base styles */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: system-ui, -apple-system, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #fff;
        }
        
        .dark body {
            color: #e5e7eb;
            background-color: #1f2937;
        }
        
        /* Container styles */
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 1rem;
        }
        
        /* Component styles will be added here */
        ${customCSS}
    </style>
    ${themeScript}
</head>
<body>
    <!-- Content will be inserted here -->
</body>
</html>`
}

// Header generator
export function generateHeader(options: {
  title: string
  subtitle?: string
  logoUrl?: string
  backgroundColor?: string
  textColor?: string
  sticky?: boolean
}): string {
  const {
    title,
    subtitle,
    logoUrl,
    backgroundColor = 'bg-white dark:bg-gray-900',
    textColor = 'text-gray-900 dark:text-white',
    sticky = false
  } = options

  const stickyClass = sticky ? 'sticky top-0 z-50' : ''

  return `
    <header class="${stickyClass} ${backgroundColor} shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div class="container mx-auto px-4 py-6">
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-4">
                    ${logoUrl ? `<img src="${logoUrl}" alt="Logo" class="h-10 w-10 rounded-lg">` : ''}
                    <div>
                        <h1 class="${textColor} text-2xl font-bold">${title}</h1>
                        ${subtitle ? `<p class="${textColor} opacity-75 text-sm">${subtitle}</p>` : ''}
                    </div>
                </div>
                <div class="flex items-center space-x-2">
                    <button id="theme-toggle" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        <svg class="w-5 h-5 dark:hidden" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"></path>
                        </svg>
                        <svg class="w-5 h-5 hidden dark:block" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    </header>`
}

// Navigation generator
export function generateNavigation(items: NavigationItem[], options: {
  orientation?: 'horizontal' | 'vertical'
  style?: 'pills' | 'tabs' | 'underline'
  backgroundColor?: string
}): string {
  const {
    orientation = 'horizontal',
    style = 'underline',
    backgroundColor = 'bg-white dark:bg-gray-900'
  } = options

  const containerClass = orientation === 'horizontal' 
    ? 'flex items-center space-x-1' 
    : 'flex flex-col space-y-1'

  const getItemClass = (isActive: boolean) => {
    const base = 'px-3 py-2 text-sm font-medium transition-colors'
    
    switch (style) {
      case 'pills':
        return isActive 
          ? `${base} bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100 rounded-lg`
          : `${base} text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg`
      case 'tabs':
        return isActive
          ? `${base} bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-t-lg border-b-0`
          : `${base} text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white`
      case 'underline':
      default:
        return isActive
          ? `${base} text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400`
          : `${base} text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border-b-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600`
    }
  }

  const navItems = items.map(item => `
    <a href="${item.href}" class="${getItemClass(item.isActive || false)}">
        ${item.label}
    </a>
  `).join('')

  return `
    <nav class="${backgroundColor} border-b border-gray-200 dark:border-gray-700">
        <div class="container mx-auto px-4">
            <div class="${containerClass} py-4">
                ${navItems}
            </div>
        </div>
    </nav>`
}

// Alert/Message generator
export function generateAlert(options: AlertOptions): string {
  const { type, title, message, dismissible = true } = options

  const getAlertClass = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200'
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
      case 'info':
      default:
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200'
    }
  }

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>'
      case 'warning':
        return '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>'
      case 'error':
        return '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg>'
      case 'info':
      default:
        return '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path></svg>'
    }
  }

  return `
    <div class="rounded-lg border p-4 ${getAlertClass()}" role="alert">
        <div class="flex items-start">
            <div class="flex-shrink-0">
                ${getIcon()}
            </div>
            <div class="ml-3 flex-1">
                ${title ? `<h3 class="text-sm font-medium">${title}</h3>` : ''}
                <p class="${title ? 'mt-1 ' : ''}text-sm">${message}</p>
            </div>
            ${dismissible ? `
                <div class="ml-auto flex-shrink-0">
                    <button type="button" class="inline-flex rounded-md p-1.5 hover:bg-black/5 dark:hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent" onclick="this.closest('[role=alert]').remove()">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                </div>
            ` : ''}
        </div>
    </div>`
}

// Complete page generator with all components
export function generateCompletePage(options: {
  templateOptions?: HTMLTemplateOptions
  header?: Parameters<typeof generateHeader>[0]
  navigation?: { items: NavigationItem[]; options?: Parameters<typeof generateNavigation>[1] }
  alerts?: AlertOptions[]
  mainContent?: string
  footer?: string
}): string {
  const {
    templateOptions = {},
    header,
    navigation,
    alerts = [],
    mainContent = '<main class="container mx-auto px-4 py-8"><h2 class="text-2xl font-bold mb-4">Welcome</h2><p>Your content goes here.</p></main>',
    footer = '<footer class="bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-8"><div class="container mx-auto px-4 text-center text-gray-600 dark:text-gray-400"><p>&copy; 2024 Generated by AI Chat Platform. All rights reserved.</p></div></footer>'
  } = options

  const baseHTML = generateBaseHTML(templateOptions)
  
  let pageContent = ''
  
  // Add header
  if (header) {
    pageContent += generateHeader(header)
  }
  
  // Add navigation
  if (navigation) {
    pageContent += generateNavigation(navigation.items, navigation.options || {})
  }
  
  // Add alerts
  if (alerts.length > 0) {
    const alertsHTML = alerts.map(alert => generateAlert(alert)).join('\n')
    pageContent += `
      <div class="container mx-auto px-4 pt-4 space-y-4">
        ${alertsHTML}
      </div>`
  }
  
  // Add main content
  pageContent += mainContent
  
  // Add footer
  pageContent += footer

  // Add theme toggle script
  const themeScript = `
    <script>
      // Theme toggle functionality
      document.getElementById('theme-toggle')?.addEventListener('click', function() {
        if (document.documentElement.classList.contains('dark')) {
          document.documentElement.classList.remove('dark')
          localStorage.theme = 'light'
        } else {
          document.documentElement.classList.add('dark')
          localStorage.theme = 'dark'
        }
      })
    </script>`

  // Insert content into base HTML
  return baseHTML.replace('<!-- Content will be inserted here -->', pageContent + themeScript)
}

// Cache for HTML detection results to prevent repetitive processing
const htmlDetectionCache = new Map<string, { hasHTML: boolean; htmlContent?: string; filename?: string; timestamp: number }>()
const CACHE_EXPIRY = 5 * 60 * 1000 // 5 minutes
const MAX_CACHE_SIZE = 100

// Utility function to detect HTML code in AI responses
export function detectHTMLInContent(content: string): { hasHTML: boolean; htmlContent?: string; filename?: string } {
  // Generate cache key from content hash
  const cacheKey = content.length > 1000 ? content.substring(0, 1000) + content.length : content
  
  // Check cache first
  const cached = htmlDetectionCache.get(cacheKey)
  if (cached && (Date.now() - cached.timestamp) < CACHE_EXPIRY) {
    return { hasHTML: cached.hasHTML, htmlContent: cached.htmlContent, filename: cached.filename }
  }

  // Clean up old cache entries if needed
  if (htmlDetectionCache.size > MAX_CACHE_SIZE) {
    const now = Date.now()
    for (const [key, value] of htmlDetectionCache.entries()) {
      if (now - value.timestamp > CACHE_EXPIRY) {
        htmlDetectionCache.delete(key)
      }
    }
  }
  
  // Look for HTML patterns in the content (more comprehensive)
  const htmlPatterns = [
    /```html\s*([\s\S]*?)\s*```/gi,
    /```\s*(<!DOCTYPE html[\s\S]*?<\/html>)\s*```/gi,
    /```\s*(<!doctype html[\s\S]*?<\/html>)\s*```/gi,
    /<(!DOCTYPE html|html|head|body|header|nav|main|section|article|footer)[\s\S]*?>/gi
  ]

  // Look for CSS patterns in the content
  const cssPatterns = [
    /```css\s*([\s\S]*?)\s*```/gi,
    /```\s*([^`]*(?:body|html|\.[\w-]+|#[\w-]+)[\s\S]*?)\s*```/gi
  ]

  let htmlContent = '';
  let cssContent = '';
  let hasHTML = false;

  // Extract HTML content
  for (const pattern of htmlPatterns) {
    pattern.lastIndex = 0; // Reset regex state
    const match = pattern.exec(content)
    if (match) {
      htmlContent = (match[1] || match[0]).trim()
      hasHTML = true
      // Only log when HTML is actually detected
      console.log("✅ HTML detected! Length:", htmlContent.length);
      break
    }
  }

  // Extract CSS content if HTML was found
  if (hasHTML) {
    // Reset regex lastIndex
    cssPatterns.forEach(pattern => pattern.lastIndex = 0)
    
    for (const pattern of cssPatterns) {
      const match = pattern.exec(content)
      if (match) {
        const potentialCSS = (match[1] || match[0]).trim()
        // Check if this looks like CSS (contains selectors or properties)
        if (potentialCSS.includes('{') && potentialCSS.includes('}') && 
            (potentialCSS.includes(':') || potentialCSS.includes('body') || potentialCSS.includes('html'))) {
          cssContent = potentialCSS
          console.log("✅ CSS detected and merged! Length:", cssContent.length);
          break
        }
      }
    }

    // If we have both HTML and CSS, merge them
    if (cssContent && htmlContent) {
      // Check if HTML already has embedded styles
      if (!htmlContent.includes('<style>') && !htmlContent.includes('<style ')) {
        // Find the head tag and insert the CSS
        const headMatch = htmlContent.match(/(<head[^>]*>)([\s\S]*?)(<\/head>)/i)
        if (headMatch && headMatch.index !== undefined) {
          const beforeHead = htmlContent.substring(0, headMatch.index + headMatch[1].length)
          const headContent = headMatch[2]
          const afterHead = htmlContent.substring(headMatch.index + headMatch[1].length + headContent.length)
          
          // Insert CSS into head
          htmlContent = beforeHead + headContent + 
            `\n    <style>\n        ${cssContent}\n    </style>\n` + afterHead
        } else {
          // If no head tag found, try to add it
          const htmlTagMatch = htmlContent.match(/(<html[^>]*>)/i)
          if (htmlTagMatch && htmlTagMatch.index !== undefined) {
            const insertPoint = htmlTagMatch.index + htmlTagMatch[1].length
            const before = htmlContent.substring(0, insertPoint)
            const after = htmlContent.substring(insertPoint)
            htmlContent = before + 
              `\n<head>\n    <style>\n        ${cssContent}\n    </style>\n</head>` + after
          }
        }
      }
    }
  }

  let result: { hasHTML: boolean; htmlContent?: string; filename?: string }

  if (hasHTML) {
    // Generate filename based on content
    let filename = 'generated.html'
    const titleMatch = htmlContent.match(/<title[^>]*>(.*?)<\/title>/i)
    if (titleMatch && titleMatch[1]) {
      filename = titleMatch[1].replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-').toLowerCase() + '.html'
    }

    result = {
      hasHTML: true,
      htmlContent,
      filename
    }
  } else {
    result = { hasHTML: false }
  }

  // Cache the result
  htmlDetectionCache.set(cacheKey, {
    ...result,
    timestamp: Date.now()
  })

  return result
} 