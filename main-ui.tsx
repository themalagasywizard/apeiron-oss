"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { formatFileSize } from "@/lib/file-utils"
import ModelLogo from "@/components/model-logos"
import HTMLPreview from "@/components/html-preview"
import VideoPreview from "@/components/video-preview"
import { detectHTMLInContent } from "@/lib/html-templates"
import {
  Menu,
  X,
  Send,
  Mic,
  Sun,
  Moon,
  ChevronDown,
  ChevronRight,
  Settings,
  LogOut,
  MessageSquare,
  Folder,
  Check,
  Eye,
  EyeOff,
  AlertCircle,
  Paperclip,
  FileImage,
  FileText,
  Loader2,
  Download,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Globe,
  Code,
} from "lucide-react"

// Types
type Message = {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
  attachments?: ProcessedFile[]
  model?: string
  provider?: string
  isError?: boolean
  retryData?: {
    originalMessage: string
    attachments?: ProcessedFile[]
  }
}

type ProcessedFile = {
  id: string
  name: string
  type: string
  size: number
  url?: string
  extractedText?: string
  thumbnailUrl?: string
  uploadedAt: string
}

type Conversation = {
  id: string
  title: string
  timestamp: Date
  model: string
  messages: Message[]
}

type Project = {
  id: string
  name: string
  conversations: string[] // IDs of conversations
}

type Model = {
  id: string
  name: string
  icon: string
  apiKey?: string
  provider: "openai" | "claude" | "gemini" | "deepseek" | "grok" | "openrouter" | "veo2"
  isCustom?: boolean
  customModelName?: string
  enabled?: boolean
  subModels?: string[] // Array of sub-model IDs that are enabled for this provider
}

type UserSettings = {
  temperature: number
  models: Model[]
  openrouterEnabled: boolean
  openrouterApiKey: string
  openrouterModelName: string
  openaiApiKey: string
  claudeApiKey: string
  geminiApiKey: string
  deepseekApiKey: string
  grokApiKey: string
  veo2ApiKey: string
  enabledSubModels: { [provider: string]: string[] } // Track which sub-models are enabled per provider
}

type MainUIProps = {
  conversations?: Conversation[]
  projects?: Project[]
  models?: Model[]
  currentConversation?: Conversation
  currentModel?: string
  userSettings?: UserSettings
  isTyping?: boolean
  onSendMessage?: (message: string, attachments?: ProcessedFile[], webSearchEnabled?: boolean, codeGenerationEnabled?: boolean) => void
  onSelectConversation?: (id: string) => void
  onSelectModel?: (id: string) => void
  onCreateConversation?: () => void
  onCreateProject?: () => void
  onToggleTheme?: () => void
  onLogout?: () => void
  onSaveSettings?: (settings: any) => void
  onRenameConversation?: (id: string, newTitle: string) => void
  onRetryMessage?: (messageId: string) => void
}

export default function MainUI({
  conversations = [],
  projects = [],
  models = [],
  currentConversation = {
    id: "default",
    title: "New Conversation",
    timestamp: new Date(),
    model: "gpt-4",
    messages: [],
  },
  currentModel = "gpt-4",
  userSettings = {
    temperature: 0.7,
    models: [],
    openrouterEnabled: false,
    openrouterApiKey: "",
    openrouterModelName: "",
    openaiApiKey: "",
    claudeApiKey: "",
    geminiApiKey: "",
    deepseekApiKey: "",
    grokApiKey: "",
    veo2ApiKey: "",
    enabledSubModels: {}
  },
  isTyping = false,
  onSendMessage = () => {},
  onSelectConversation = () => {},
  onSelectModel = () => {},
  onCreateConversation = () => {},
  onCreateProject = () => {},
  onToggleTheme = () => {},
  onLogout = () => {},
  onSaveSettings = () => {},
  onRenameConversation = () => {},
  onRetryMessage = () => {},
}: MainUIProps) {
  // Comprehensive model library with latest versions
  const modelLibrary = {
    openai: {
      name: "OpenAI",
      models: [
        { id: "gpt-4.1", name: "GPT-4.1", description: "Latest flagship model with enhanced capabilities" },
        { id: "gpt-4o", name: "GPT-4o", description: "Multimodal model with vision and audio" },
        { id: "gpt-4", name: "GPT-4", description: "Previous generation model" },
        { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", description: "Fast and cost-effective" }
      ]
    },
    claude: {
      name: "Anthropic (Claude)",
      models: [
        { id: "claude-opus-4", name: "Claude 4 Opus", description: "Most powerful model for complex tasks" },
        { id: "claude-sonnet-4", name: "Claude 4 Sonnet", description: "Balanced performance and efficiency" },
        { id: "claude-3.7-sonnet", name: "Claude 3.7 Sonnet", description: "Extended thinking capabilities" },
        { id: "claude-3.5-sonnet", name: "Claude 3.5 Sonnet", description: "High performance model" }
      ]
    },
    gemini: {
      name: "Google (Gemini + VEO2)",
      models: [
        { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Fast multimodal processing" },
        { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "Advanced reasoning capabilities" },
        { id: "veo2", name: "VEO 2", description: "Video generation model" }
      ]
    },
    deepseek: {
      name: "DeepSeek",
      models: [
        { id: "deepseek-v3", name: "DeepSeek V3", description: "Latest reasoning model" },
        { id: "deepseek-coder", name: "DeepSeek Coder", description: "Specialized for coding" }
      ]
    },
    grok: {
      name: "xAI (Grok)",
      models: [
        { id: "grok-3", name: "Grok 3", description: "Advanced reasoning with real-time data" },
        { id: "grok-3-mini", name: "Grok 3 Mini", description: "Lightweight thinking model" },
        { id: "grok-2", name: "Grok 2", description: "Previous generation model" }
      ]
    }
  }

  // Helper function to get model icons
  const getModelIcon = (provider: string, modelId: string): string => {
    const iconMap: { [key: string]: { [key: string]: string } } = {
      openai: {
        "gpt-4.1": "41",
        "gpt-4o": "4O",
        "gpt-4": "G4",
        "gpt-3.5-turbo": "35"
      },
      claude: {
        "claude-opus-4": "O4",
        "claude-sonnet-4": "S4",
        "claude-3.7-sonnet": "37",
        "claude-3.5-sonnet": "35"
      },
      gemini: {
        "gemini-2.5-flash": "2F",
        "gemini-2.5-pro": "2P",
        "veo2": "V2"
      },
      deepseek: {
        "deepseek-v3": "D3",
        "deepseek-coder": "DC"
      },
      grok: {
        "grok-3": "G3",
        "grok-3-mini": "3M",
        "grok-2": "G2"
      }
    }
    return iconMap[provider]?.[modelId] || "AI"
  }

  // State
  const [theme, setTheme] = useState<"dark" | "light">("dark")
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const [settingsOpen, setSettingsOpen] = useState(false)

  const [settingsTab, setSettingsTab] = useState<"general" | "models">("general")
  const [newModelProvider, setNewModelProvider] = useState<"openai" | "claude" | "gemini" | "deepseek" | "grok" | "openrouter">("openai")
  const [newModelApiKey, setNewModelApiKey] = useState("")
  const [newModelCustomName, setNewModelCustomName] = useState("")
  const [showNewModelApiKey, setShowNewModelApiKey] = useState(false)
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState("")
  const [editingProvider, setEditingProvider] = useState<string | null>(null) // Track which provider is being edited
  const [tempSelectedModels, setTempSelectedModels] = useState<{ [provider: string]: string[] }>({}) // Temporary selection during editing

  // File upload state
  const [attachments, setAttachments] = useState<ProcessedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  // Web search state
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)

  // Code generation state
  const [codeGenerationEnabled, setCodeGenerationEnabled] = useState(false)

  // Speech recognition state
  const [isListening, setIsListening] = useState(false)

  // Use models from props (calculated in page.tsx with proper API key logic)
  const availableModels = models

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<any>(null)

  // Check if current model supports web search
  const isWebSearchCompatible = () => {
    const currentModelData = availableModels.find(m => m.id === currentModel)
    return currentModelData && (currentModelData.provider === "gemini" || currentModelData.provider === "grok")
  }

  // Check if mobile on mount and window resize
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768)
      if (window.innerWidth < 768) {
        setSidebarOpen(false)
      }
    }

    checkIfMobile()
    window.addEventListener("resize", checkIfMobile)

    return () => {
      window.removeEventListener("resize", checkIfMobile)
    }
  }, [])

  // Scroll to bottom of messages when new message is added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [currentConversation.messages])

  // Disable web search when switching to incompatible models
  useEffect(() => {
    if (!isWebSearchCompatible() && webSearchEnabled) {
      setWebSearchEnabled(false)
    }
  }, [currentModel])

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    if (!file) return

    setIsUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed')
      }

      // Add the processed file to attachments
      setAttachments(prev => [...prev, result.file])
    } catch (error) {
      console.error('Upload error:', error)
      setError(error instanceof Error ? error.message : 'Failed to upload file')
      setTimeout(() => setError(null), 5000)
    } finally {
      setIsUploading(false)
    }
  }

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        handleFileUpload(files[i])
      }
    }
    // Reset the input
    e.target.value = ''
  }

  // Remove attachment
  const removeAttachment = (attachmentId: string) => {
    setAttachments(prev => prev.filter(att => att.id !== attachmentId))
  }

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    files.forEach(file => {
      handleFileUpload(file)
    })
  }

  // Handle sending a message
  const handleSendMessage = () => {
    if (inputValue.trim() || attachments.length > 0) {
      onSendMessage(inputValue, attachments.length > 0 ? attachments : undefined, webSearchEnabled, codeGenerationEnabled)
      setInputValue("")
      setAttachments([])
    }
  }

  // Handle key press in input
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Handle conversation renaming
  const handleStartRename = (conversationId: string, currentTitle: string) => {
    setEditingConversationId(conversationId)
    setEditingTitle(currentTitle)
  }

  const handleSaveRename = () => {
    if (editingConversationId && editingTitle.trim()) {
      onRenameConversation(editingConversationId, editingTitle.trim())
    }
    setEditingConversationId(null)
    setEditingTitle("")
  }

  const handleCancelRename = () => {
    setEditingConversationId(null)
    setEditingTitle("")
  }

  const handleRenameKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleSaveRename()
    } else if (e.key === "Escape") {
      e.preventDefault()
      handleCancelRename()
    }
  }

  // Toggle project expansion
  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }))
  }

  // Add new model (save API keys and enable sub-models)
  const handleAddModel = () => {
    if (!newModelApiKey.trim()) {
      setError("API key is required")
      setTimeout(() => setError(null), 3000)
      return
    }

    if (newModelProvider === "openrouter" && !newModelCustomName.trim()) {
      setError("Model name is required for OpenRouter")
      setTimeout(() => setError(null), 3000)
      return
    }

    // Save API key and open model selection
    let updatedSettings = { ...userSettings }

    if (newModelProvider === "openrouter") {
      updatedSettings = {
        ...userSettings,
        openrouterEnabled: true,
        openrouterApiKey: newModelApiKey,
        openrouterModelName: newModelCustomName,
        models: [] // Clear other models when OpenRouter is enabled
      }
    } else {
      // Store API keys in the correct field based on provider
      switch (newModelProvider) {
        case "openai":
          updatedSettings.openaiApiKey = newModelApiKey
          break
        case "claude":
          updatedSettings.claudeApiKey = newModelApiKey
          break
        case "gemini":
          updatedSettings.geminiApiKey = newModelApiKey
          break
        case "deepseek":
          updatedSettings.deepseekApiKey = newModelApiKey
          break
        case "grok":
          updatedSettings.grokApiKey = newModelApiKey
          break
      }
      updatedSettings.openrouterEnabled = false
      
      // Initialize with all models enabled by default for the provider
      const providerModels = modelLibrary[newModelProvider]?.models.map(m => m.id) || []
      updatedSettings.enabledSubModels = {
        ...updatedSettings.enabledSubModels,
        [newModelProvider]: providerModels
      }
    }

    onSaveSettings(updatedSettings)

    // Reset form
    setNewModelApiKey("")
    setNewModelCustomName("")
    setNewModelProvider("openai")
  }

  // Remove model (clear API keys and enabled sub-models)
  const handleRemoveModel = (provider: string) => {
    let updatedSettings = { ...userSettings }
    
    // Clear the API key for the provider
    switch (provider) {
      case "openai":
        updatedSettings.openaiApiKey = ""
        break
      case "claude":
        updatedSettings.claudeApiKey = ""
        break
      case "gemini":
        updatedSettings.geminiApiKey = ""
        break
      case "deepseek":
        updatedSettings.deepseekApiKey = ""
        break
      case "grok":
        updatedSettings.grokApiKey = ""
        break
    }
    
    // Clear enabled sub-models for the provider
    updatedSettings.enabledSubModels = {
      ...updatedSettings.enabledSubModels,
      [provider]: []
    }
    
    onSaveSettings(updatedSettings)
  }

  // Toggle OpenRouter
  const handleToggleOpenRouter = (enabled: boolean) => {
    const updatedSettings = {
      ...userSettings,
      openrouterEnabled: enabled,
      models: enabled ? [] : userSettings.models
    }
    onSaveSettings(updatedSettings)
  }

  // Save general settings
  const handleSaveGeneralSettings = () => {
    const updatedSettings = {
      ...userSettings,
      temperature: userSettings.temperature
    }
    onSaveSettings(updatedSettings)
    setSettingsOpen(false)
  }

  // Toggle theme
  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark"
    setTheme(newTheme)
    onToggleTheme()
    document.documentElement.classList.toggle("dark", newTheme === "dark")
  }

  // Speech recognition functions
  const startListening = async () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setError('Speech recognition not supported in this browser. Please use Chrome, Edge, or Safari.')
      setTimeout(() => setError(null), 5000)
      return
    }

    try {
      // First, request microphone permission explicitly
      console.log('Requesting microphone permission...')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      console.log('Microphone permission granted')
      
      // Stop the stream immediately - we just needed permission
      stream.getTracks().forEach(track => track.stop())

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      const recognition = new SpeechRecognition()
      
      recognition.lang = 'en-US'
      recognition.interimResults = true
      recognition.continuous = true  // Keep listening until manually stopped
      recognition.maxAlternatives = 1

      recognition.onstart = () => {
        setIsListening(true)
        setError(null)
        console.log('Speech recognition started - speak now!')
        // Clear any existing text when starting new session
        setInputValue('')
      }

      recognition.onresult = (event: any) => {
        console.log('Speech recognition result received!')
        let transcript = ''
        
        // Get all results and combine them
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript
        }
        
        console.log('Transcript:', transcript)
        setInputValue(transcript.trim())
      }

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
        
        // Handle specific errors differently
        switch (event.error) {
          case 'no-speech':
            console.log('No speech detected - please speak louder or closer to microphone')
            // Don't stop - just wait for speech
            return
          case 'audio-capture':
            setError('Microphone not accessible. Please check your microphone and permissions.')
            setIsListening(false)
            break
          case 'not-allowed':
            setError('Microphone access denied. Please allow microphone access in your browser.')
            setIsListening(false)
            break
          case 'network':
            setError('Network error. Please check your connection.')
            setIsListening(false)
            break
          case 'aborted':
            // User manually stopped, no error needed
            console.log('Speech recognition aborted by user')
            setIsListening(false)
            break
          default:
            setError(`Speech recognition error: ${event.error}`)
            setIsListening(false)
        }
        
        if (event.error !== 'aborted' && event.error !== 'no-speech') {
          setTimeout(() => setError(null), 5000)
        }
      }

      recognition.onend = () => {
        console.log('Speech recognition ended')
        
        // If we're still supposed to be listening and it wasn't manually stopped
        if (isListening && recognitionRef.current) {
          console.log('Attempting to restart speech recognition...')
          // Add a small delay before restarting to prevent rapid loops
          setTimeout(() => {
            if (isListening && recognitionRef.current) {
              try {
                recognitionRef.current.start()
              } catch (error) {
                console.error('Failed to restart recognition:', error)
                setIsListening(false)
                setError('Speech recognition stopped unexpectedly. Please try again.')
                setTimeout(() => setError(null), 3000)
              }
            }
          }, 500) // Increased delay to prevent rapid restarts
        } else {
          setIsListening(false)
          recognitionRef.current = null
        }
      }

      recognition.start()
      recognitionRef.current = recognition
      
    } catch (error) {
      console.error('Failed to start speech recognition:', error)
      if (error instanceof Error && error.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone access and try again.')
      } else if (error instanceof Error && error.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone and try again.')
      } else {
        setError('Failed to start speech recognition. Please check your microphone and try again.')
      }
      setTimeout(() => setError(null), 5000)
      setIsListening(false)
    }
  }

  const stopListening = () => {
    console.log('Stopping speech recognition...')
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsListening(false)
  }

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [])

  // Detect video generation content
  const detectVideoContent = (content: string) => {
    // Enhanced patterns for real VEO2 integration
    const videoPattern = /🎬.*?Video Generation.*?(Started|Complete|Initiated|Processing)/i
    const promptPattern = /\*\*Prompt:\*\*\s*(.+?)(?=\n|$)/i
    const operationPattern = /\*\*Operation Name:\*\*\s*([^\s\n]+)/i
    const videoUrlPattern = /Video URL:\s*(https?:\/\/[^\s\n]+)/i
    const statusPattern = /\*\*Status:\*\*\s*([^\n]+)/i
    
    const hasVideo = videoPattern.test(content)
    const promptMatch = content.match(promptPattern)
    const operationMatch = content.match(operationPattern)
    const videoUrlMatch = content.match(videoUrlPattern)
    const statusMatch = content.match(statusPattern)
    
    // Check if it's currently generating/processing
    const isGenerating = content.includes('Video Generation Started') || 
                        content.includes('Generating Video') ||
                        content.includes('Processing with Google VEO 2') ||
                        content.includes('Demo processing') ||
                        (statusMatch && statusMatch[1].toLowerCase().includes('processing'))
    
    return {
      hasVideo,
      prompt: promptMatch ? promptMatch[1].trim() : null,
      isGenerating,
      operationName: operationMatch ? operationMatch[1].trim() : null,
      videoUrl: videoUrlMatch ? videoUrlMatch[1].trim() : null
    }
  }

  // Format message content
  const formatMessageContent = (content: string) => {
    // Clean up content for minimalist formatting
    const cleaned = content
      // Remove all emojis
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      // Remove excessive hashtags and replace with clean headers
      .replace(/^#{1,6}\s+/gm, '')
      // Clean markdown formatting to HTML
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm font-mono">$1</code>')
      // Handle web search results
      .replace(/\[source:\s*(\d+)]/g, '<a href="#source-$1" class="text-xs align-super bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-1 py-0.5 rounded-sm no-underline">$1</a>')
      // Handle markdown links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-purple-500 hover:underline">$1</a>')
      // Handle code blocks with proper escaping and language detection
      .replace(/```([\w+-]*)\n?([\s\S]*?)```/g, (match, lang, code) => {
        // Escape HTML entities in code to prevent parsing issues
        const escapedCode = code
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;');
        
        // Add language-specific styling
        const languageClass = lang ? `language-${lang.toLowerCase()}` : '';
        const languageLabel = lang ? `<span class="absolute top-2 right-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">${lang}</span>` : '';
        
        return `<div class="relative"><pre class="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto my-4 ${languageClass}"><code class="font-mono text-sm">${escapedCode}</code></pre>${languageLabel}</div>`;
      })
      // Handle bullet points with proper spacing
      .replace(/^[\s]*[-*+]\s+(.+)$/gm, '<li class="mb-2">$1</li>')
      // Handle numbered lists
      .replace(/^[\s]*\d+\.\s+(.+)$/gm, '<li class="mb-2">$1</li>')
      // Convert multiple line breaks to paragraph breaks
      .replace(/\n\s*\n/g, '</p><p class="mb-4">')
      // Convert single line breaks to line breaks
      .replace(/\n/g, '<br/>')
      // Wrap content in paragraph tags
      .replace(/^/, '<p class="mb-4">')
      .replace(/$/, '</p>')
      // Wrap list items in ul tags
      .replace(/(<li class="mb-2">.*?<\/li>)/g, (match) => {
        return '<ul class="list-disc list-inside space-y-2 mb-4 ml-4">' + match + '</ul>';
      })
      // Clean up empty paragraphs
      .replace(/<p class="mb-4">\s*<\/p>/g, '')
      // Fix multiple consecutive paragraph breaks
      .replace(/(<\/p>)(\s*<p class="mb-4">)/g, '$1$2')
      .trim();

    return cleaned;
  }

  // Start editing a provider's model selection
  const handleEditProvider = (provider: string) => {
    setEditingProvider(provider)
    setTempSelectedModels({
      ...tempSelectedModels,
      [provider]: [...(userSettings.enabledSubModels[provider] || [])]
    })
  }

  // Toggle a sub-model selection during editing
  const handleToggleSubModel = (provider: string, modelId: string) => {
    const currentModels = tempSelectedModels[provider] || []
    const updatedModels = currentModels.includes(modelId)
      ? currentModels.filter(id => id !== modelId)
      : [...currentModels, modelId]
    
    setTempSelectedModels({
      ...tempSelectedModels,
      [provider]: updatedModels
    })
  }

  // Save the sub-model selection
  const handleSaveModelSelection = (provider: string) => {
    const updatedSettings = {
      ...userSettings,
      enabledSubModels: {
        ...userSettings.enabledSubModels,
        [provider]: tempSelectedModels[provider] || []
      }
    }
    onSaveSettings(updatedSettings)
    setEditingProvider(null)
    setTempSelectedModels({})
  }

  // Cancel editing
  const handleCancelModelSelection = () => {
    setEditingProvider(null)
    setTempSelectedModels({})
  }

  return (
    <div
      className={`font-inter h-screen flex ${theme === "dark" ? "dark bg-gradient-to-br from-gray-900 to-gray-800" : "bg-gradient-to-br from-gray-50 to-white"}`}
    >
      <div className="flex flex-1 overflow-hidden">
        {/* Mobile Menu Button (only visible when sidebar is closed) */}
        {isMobile && !sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="fixed top-4 left-4 z-30 p-2 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/20 dark:border-gray-700/20 hover:bg-white/90 dark:hover:bg-gray-800/90 transition-colors shadow-lg"
            aria-label="Open sidebar"
          >
            <Menu className="w-6 h-6 text-gray-700 dark:text-gray-200" />
          </button>
        )}

        {/* Sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.aside
              initial={{ x: isMobile ? -280 : 0, opacity: isMobile ? 0 : 1 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: isMobile ? -280 : 0, opacity: isMobile ? 0 : 1 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className={`
                w-full max-w-[280px] h-full flex flex-col
                ${isMobile ? "fixed z-20 top-0 left-0 h-screen" : ""}
                backdrop-blur-xl bg-white/20 dark:bg-gray-900/40
                border-r border-gray-200/20 dark:border-gray-700/20
              `}
            >
              {/* Sidebar Header with Title and Controls */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200/20 dark:border-gray-700/20 h-[60px]">
                <h1 className="text-lg font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                  AI Chat
                </h1>
                <div className="flex items-center gap-1">
                <button
                    onClick={toggleTheme}
                    className="p-1.5 rounded-lg hover:bg-gray-200/20 dark:hover:bg-gray-700/20 transition-colors"
                    aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                  >
                    {theme === "dark" ? <Sun className="w-4 h-4 text-gray-200" /> : <Moon className="w-4 h-4 text-gray-700" />}
                </button>

                  {/* Toggle Sidebar Button */}
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-gray-200/20 dark:hover:bg-gray-700/20 transition-colors ml-1"
                    aria-label="Toggle sidebar"
                  >
                    {sidebarOpen ? <PanelLeftClose className="w-4 h-4 text-gray-700 dark:text-gray-200" /> : <PanelLeftOpen className="w-4 h-4 text-gray-700 dark:text-gray-200" />}
                  </button>
                </div>
              </div>

              {/* Conversation History */}
              <div className="flex-1 overflow-y-auto p-2">
                <div className="mb-4">
                  <div className="flex items-center justify-between px-2 py-1">
                    <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">Conversations</h2>
                    <button
                      onClick={onCreateConversation}
                      className="p-1 rounded hover:bg-gray-200/20 dark:hover:bg-gray-700/20 transition-colors"
                      aria-label="New conversation"
                    >
                      <MessageSquare className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </button>
                  </div>

                  <div className="mt-2 space-y-1">
                    {conversations.map((conversation) => (
                      <div
                        key={conversation.id}
                        className={`
                          w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200
                          hover:bg-white/20 dark:hover:bg-gray-800/40 cursor-pointer
                          ${
                            currentConversation.id === conversation.id
                              ? "bg-white/30 dark:bg-gray-800/60 shadow-sm"
                              : "bg-transparent"
                          }
                        `}
                        onClick={() => onSelectConversation(conversation.id)}
                      >
                        {editingConversationId === conversation.id ? (
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={handleRenameKeyPress}
                            onBlur={handleSaveRename}
                            className="w-full font-medium text-gray-800 dark:text-gray-200 bg-white/20 dark:bg-gray-800/40 border border-gray-200/20 dark:border-gray-700/20 px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-sm"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <div 
                            className="font-medium text-gray-800 dark:text-gray-200 truncate"
                            title="Double-click to rename conversation"
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              handleStartRename(conversation.id, conversation.title);
                            }}
                          >
                          {conversation.title}
                        </div>
                        )}
                        <div className="mt-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(conversation.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Projects */}
                <div>
                  <div className="flex items-center justify-between px-2 py-1">
                    <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">Projects</h2>
                    <button
                      onClick={onCreateProject}
                      className="p-1 rounded hover:bg-gray-200/20 dark:hover:bg-gray-700/20 transition-colors"
                      aria-label="New project"
                    >
                      <Folder className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </button>
                  </div>

                  <div className="mt-2 space-y-1">
                    {projects.map((project) => (
                      <div key={project.id}>
                        <button
                          onClick={() => toggleProject(project.id)}
                          className="w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between hover:bg-white/20 dark:hover:bg-gray-800/40 transition-all duration-200"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200">{project.name}</span>
                          <div className="flex items-center">
                            <span className="text-xs mr-2 text-gray-500 dark:text-gray-400">
                              {project.conversations.length}
                            </span>
                            {expandedProjects[project.id] ? (
                              <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                            )}
                          </div>
                        </button>

                        {expandedProjects[project.id] && (
                          <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200/30 dark:border-gray-700/30 pl-2">
                            {project.conversations.map((convId) => {
                              const conv = conversations.find((c) => c.id === convId)
                              if (!conv) return null

                              return (
                                <div
                                  key={conv.id}
                                  onClick={() => onSelectConversation(conv.id)}
                                  className={`
                                    w-full text-left px-3 py-1.5 rounded-lg text-xs transition-all duration-200
                                    hover:bg-white/20 dark:hover:bg-gray-800/40 cursor-pointer
                                    ${
                                      currentConversation.id === conv.id
                                        ? "bg-white/30 dark:bg-gray-800/60 shadow-sm"
                                        : "bg-transparent"
                                    }
                                  `}
                                >
                                  {editingConversationId === conv.id ? (
                                    <input
                                      type="text"
                                      value={editingTitle}
                                      onChange={(e) => setEditingTitle(e.target.value)}
                                      onKeyDown={handleRenameKeyPress}
                                      onBlur={handleSaveRename}
                                      className="w-full font-medium text-gray-800 dark:text-gray-200 bg-white/20 dark:bg-gray-800/40 border border-gray-200/20 dark:border-gray-700/20 px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-xs"
                                      autoFocus
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  ) : (
                                    <div 
                                      className="font-medium text-gray-800 dark:text-gray-200 truncate"
                                      title="Double-click to rename conversation"
                                      onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        handleStartRename(conv.id, conv.title);
                                      }}
                                    >
                                    {conv.title}
                                  </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Profile and Settings Section */}
              <div className="px-4 py-3 border-t border-gray-200/20 dark:border-gray-700/20 h-[72px] flex items-center gap-3">
                {/* Profile Button */}
                <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white font-medium shadow-lg">
                  U
              </div>

              {/* Settings Button */}
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="flex-1 h-12 flex items-center justify-center gap-2 rounded-xl bg-white/20 dark:bg-gray-800/40 hover:bg-white/30 dark:hover:bg-gray-800/60 transition-colors text-gray-800 dark:text-gray-200"
                  aria-label="Open settings"
                >
                  <Settings className="w-4 h-4" />
                  <span>Settings</span>
                </button>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Desktop Sidebar Toggle (only visible when sidebar is closed on desktop) */}
              {!isMobile && !sidebarOpen && (
                <button
                  onClick={() => setSidebarOpen(true)}
            className="fixed top-4 left-4 z-30 p-2 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/20 dark:border-gray-700/20 hover:bg-white/90 dark:hover:bg-gray-800/90 transition-colors shadow-lg"
                  aria-label="Open sidebar"
                >
            <Menu className="w-6 h-6 text-gray-700 dark:text-gray-200" />
                </button>
              )}

        {/* Main Chat Panel */}
        <main className="flex-1 flex flex-col overflow-hidden">

          {/* Error Alert */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="mx-4 mt-2 p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-700 dark:text-red-300 flex items-center gap-2"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {currentConversation.messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`
                    max-w-[85%] md:max-w-[70%] rounded-2xl p-4 
                    ${
                      message.role === "user"
                        ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                        : "bg-white/20 dark:bg-gray-800/40 text-gray-800 dark:text-gray-200 border border-gray-200/20 dark:border-gray-700/20"
                    }
                  `}
                >
                  {/* Model icon and name for assistant messages */}
                  {message.role === "assistant" && (
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200/30 dark:border-gray-600/30">
                      <ModelLogo 
                        provider={(message.provider as "openai" | "claude" | "gemini" | "deepseek" | "grok" | "openrouter") || "openai"} 
                        size="sm"
                      />
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {(() => {
                          const model = availableModels.find(m => m.id === message.model || m.provider === message.provider);
                          return model?.name || message.provider || 'AI';
                        })()}
                      </span>
                    </div>
                  )}
                  {/* Attachments */}
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="mb-3 space-y-2">
                      {message.attachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          className={`
                            flex items-center gap-3 p-3 rounded-lg border 
                            ${
                              message.role === "user"
                                ? "bg-white/20 border-white/30"
                                : "bg-gray-100/50 dark:bg-gray-700/30 border-gray-200/30 dark:border-gray-600/30"
                            }
                          `}
                        >
                          {attachment.type.startsWith('image/') ? (
                            <>
                              <FileImage className="w-5 h-5 flex-shrink-0" />
                              {attachment.url && (
                                <img
                                  src={attachment.url}
                                  alt={attachment.name}
                                  className="w-16 h-16 object-cover rounded-lg"
                                />
                              )}
                            </>
                          ) : (
                            <FileText className="w-5 h-5 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{attachment.name}</div>
                            <div className="text-xs opacity-70">
                              {formatFileSize(attachment.size)}
                            </div>
                          </div>
                          {attachment.url && (
                            <a
                              href={attachment.url}
                              download={attachment.name}
                              className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Message content */}
                  {message.content && (() => {
                    const htmlDetection = detectHTMLInContent(message.content)
                    const videoDetection = detectVideoContent(message.content)
                    
                    if (videoDetection.hasVideo) {
                      return (
                        <div className="space-y-4">
                          {/* Video Preview Component */}
                                                     <VideoPreview 
                             key={`video-${message.id}-${videoDetection.operationName || 'no-op'}`}
                             prompt={videoDetection.prompt || message.content}
                             videoUrl={videoDetection.videoUrl || undefined}
                             isGenerating={videoDetection.isGenerating || false}
                             operationName={videoDetection.operationName || undefined}
                             apiKey={userSettings.veo2ApiKey || userSettings.geminiApiKey || undefined}
                             videoTitle={`VEO2 Generated Video`}
                             onDownload={(videoUrl, filename) => {
                               // Trigger download
                               const a = document.createElement('a')
                               a.href = videoUrl
                               a.download = filename
                               document.body.appendChild(a)
                               a.click()
                               document.body.removeChild(a)
                             }}
                             onError={(error) => {
                               console.error('VEO2 Video Error:', error)
                             }}
                           />
                          
                          {/* Regular message content without video markers */}
                          <div 
                            className={`prose dark:prose-invert prose-sm max-w-none text-gray-800 dark:text-gray-200 ${
                              message.isError ? 'text-red-600 dark:text-red-400' : ''
                            }`}
                            dangerouslySetInnerHTML={{ 
                              __html: formatMessageContent(message.content) 
                            }}
                          />
                        </div>
                      )
                    } else if (htmlDetection.hasHTML && htmlDetection.htmlContent) {
                      return (
                        <div className="space-y-4">
                          {/* Regular message content without HTML */}
                          <div 
                            className={`prose dark:prose-invert prose-sm max-w-none text-gray-800 dark:text-gray-200 ${
                              message.isError ? 'text-red-600 dark:text-red-400' : ''
                            }`}
                            dangerouslySetInnerHTML={{ 
                              __html: formatMessageContent(message.content.replace(/```html[\s\S]*?```/gi, '').replace(/```[\s\S]*?```/gi, '').trim()) 
                            }}
                          />
                          
                          {/* HTML Preview Component */}
                          <HTMLPreview 
                            htmlContent={htmlDetection.htmlContent}
                            filename={htmlDetection.filename}
                            onDownload={async (content, filename) => {
                              try {
                                // Save to database
                                const response = await fetch('/api/html-code', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    title: filename.replace('.html', ''),
                                    htmlContent: content,
                                    isPublic: false,
                                    tags: ['ai-generated'],
                                    templateType: 'complete'
                                  })
                                })
                                
                                if (response.ok) {
                                  const result = await response.json()
                                  console.log('HTML code saved:', result.data.id)
                                }
                              } catch (error) {
                                console.error('Failed to save HTML code:', error)
                              }
                              
                              // Trigger download
                              const blob = new Blob([content], { type: 'text/html' })
                              const url = URL.createObjectURL(blob)
                              const a = document.createElement('a')
                              a.href = url
                              a.download = filename
                              document.body.appendChild(a)
                              a.click()
                              document.body.removeChild(a)
                              URL.revokeObjectURL(url)
                            }}
                          />
                        </div>
                      )
                    } else {
                      return (
                        <div 
                          className={`prose dark:prose-invert prose-sm max-w-none text-gray-800 dark:text-gray-200 ${
                            message.isError ? 'text-red-600 dark:text-red-400' : ''
                          }`}
                          dangerouslySetInnerHTML={{ __html: formatMessageContent(message.content) }}
                        />
                      )
                    }
                  })()}

                  {/* Retry button for error messages */}
                  {message.isError && message.retryData && (
                    <div className="mt-3 pt-3 border-t border-gray-200/20 dark:border-gray-600/20">
                      <button
                        onClick={() => onRetryMessage(message.id)}
                        className="flex items-center gap-2 px-3 py-2 text-sm bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-600 dark:text-red-400 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Try Again
                      </button>
                    </div>
                  )}
                  
                  <div
                    className={`
                    text-xs mt-2 
                    ${message.role === "user" ? "text-white/70" : "text-gray-500 dark:text-gray-400"}
                  `}
                  >
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Typing Indicator with Model Logo */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white/20 dark:bg-gray-800/40 rounded-2xl p-4 border border-gray-200/20 dark:border-gray-700/20">
                  <div className="flex items-center space-x-3">
                    {/* Model Logo */}
                    <ModelLogo 
                      provider={(() => {
                        const model = availableModels.find(m => m.id === currentModel);
                        return model?.provider || "openai";
                      })()} 
                      isLoading={true} 
                      size="sm" 
                    />
                    
                    {/* Typing Animation */}
                    <div className="flex items-center space-x-1">
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.5, repeatDelay: 0 }}
                      className="w-2 h-2 rounded-full bg-gray-500 dark:bg-gray-400"
                    />
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.5, repeatDelay: 0.2 }}
                      className="w-2 h-2 rounded-full bg-gray-500 dark:bg-gray-400"
                    />
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.5, repeatDelay: 0.4 }}
                      className="w-2 h-2 rounded-full bg-gray-500 dark:bg-gray-400"
                    />
                    </div>
                    
                    {/* Model Name */}
                    <span className="text-xs text-gray-600 dark:text-gray-400 ml-2">
                      {availableModels.find(m => m.id === currentModel)?.name || 'AI'} is thinking...
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div 
            className={`px-4 py-3 border-t border-gray-200/20 dark:border-gray-700/20 backdrop-blur-lg bg-white/10 dark:bg-gray-900/30 relative ${
              isDragOver ? 'bg-purple-500/10 border-purple-500/50' : ''
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Drag overlay */}
            {isDragOver && (
              <div className="absolute inset-0 bg-purple-500/20 border-2 border-dashed border-purple-500 rounded-lg flex items-center justify-center z-10">
                <div className="text-purple-400 text-center">
                  <Paperclip className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm font-medium">Drop files here to upload</p>
                </div>
              </div>
            )}
            {/* Attachments Preview */}
            {attachments.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center gap-2 bg-white/20 dark:bg-gray-800/40 rounded-lg p-2 text-sm text-gray-800 dark:text-gray-200"
                  >
                    {attachment.type.startsWith('image/') ? (
                      <>
                        <FileImage className="w-4 h-4 flex-shrink-0" />
                        {attachment.url && (
                          <img
                            src={attachment.url}
                            alt={attachment.name}
                            className="w-8 h-8 object-cover rounded"
                          />
                        )}
                      </>
                    ) : (
                      <FileText className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span className="truncate max-w-[100px]">{attachment.name}</span>
                    <button
                      onClick={() => removeAttachment(attachment.id)}
                      className="text-gray-500 hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 w-full min-h-[48px]">
              <div className="flex-shrink-0">
                <div className="relative">
                  <select
                    value={currentModel}
                    onChange={(e) => onSelectModel(e.target.value)}
                    className="h-[48px] w-36 px-3 pr-8 rounded-xl bg-white/20 dark:bg-gray-800/40 backdrop-blur-lg border border-gray-200/20 dark:border-gray-700/20 text-gray-800 dark:text-gray-200 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    aria-label="Select AI model"
                  >
                    {availableModels.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Web Search Toggle Button (only for compatible models) */}
              {isWebSearchCompatible() && (
                <div className="flex-shrink-0">
                  <button
                    onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                    className={`h-[48px] w-[48px] rounded-xl border border-gray-200/20 dark:border-gray-700/20 transition-all duration-200 flex items-center justify-center ${
                      webSearchEnabled
                        ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg hover:shadow-blue-500/25"
                        : "bg-white/20 dark:bg-gray-800/40 hover:bg-white/30 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400"
                    }`}
                    title={webSearchEnabled ? "Web search enabled" : "Enable web search"}
                    aria-label={webSearchEnabled ? "Disable web search" : "Enable web search"}
                  >
                    {webSearchEnabled ? (
                      <Globe className="w-5 h-5" />
                    ) : (
                      <Search className="w-5 h-5" />
                    )}
                  </button>
                </div>
              )}

              {/* Code Generation Toggle Button */}
              <div className="flex-shrink-0">
                <button
                  onClick={() => setCodeGenerationEnabled(!codeGenerationEnabled)}
                  className={`h-[48px] w-[48px] rounded-xl border border-gray-200/20 dark:border-gray-700/20 transition-all duration-200 flex items-center justify-center ${
                    codeGenerationEnabled
                      ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg hover:shadow-emerald-500/25"
                      : "bg-white/20 dark:bg-gray-800/40 hover:bg-white/30 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400"
                  }`}
                  title={codeGenerationEnabled ? "Code generation mode enabled - Uses Edge Function for longer processing" : "Enable code generation mode"}
                  aria-label={codeGenerationEnabled ? "Disable code generation mode" : "Enable code generation mode"}
                >
                  <Code className="w-5 h-5" />
                </button>
              </div>

              {/* File Upload Button */}
              <div className="flex-shrink-0">
                <label className="h-[48px] w-[48px] rounded-xl bg-white/20 dark:bg-gray-800/40 hover:bg-white/30 dark:hover:bg-gray-700/50 border border-gray-200/20 dark:border-gray-700/20 transition-colors cursor-pointer flex items-center justify-center">
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf,.txt,.doc,.docx"
                    onChange={handleFileInputChange}
                    className="hidden"
                    aria-label="Upload files"
                  />
                  {isUploading ? (
                    <Loader2 className="w-5 h-5 text-gray-600 dark:text-gray-400 animate-spin" />
                  ) : (
                    <Paperclip className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  )}
                </label>
              </div>

              <div className="flex-1 bg-white/20 dark:bg-gray-800/40 rounded-xl border border-gray-200/20 dark:border-gray-700/20 overflow-hidden focus-within:ring-2 focus-within:ring-purple-500/50">
                <textarea
                  ref={chatInputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Ask anything..."
                  className="w-full px-4 py-3 bg-transparent text-gray-800 dark:text-gray-200 resize-none focus:outline-none"
                  rows={1}
                  style={{
                    height: "auto",
                    minHeight: "48px",
                    maxHeight: "200px",
                  }}
                  aria-label="Message input"
                />
              </div>

              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() && attachments.length === 0}
                className={`
                  h-[48px] w-[48px] rounded-xl flex-shrink-0 transition-all duration-200 flex items-center justify-center
                  ${
                    inputValue.trim() || attachments.length > 0
                      ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg hover:shadow-purple-500/25"
                      : "bg-gray-200/50 dark:bg-gray-700/50 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                  }
                `}
                aria-label="Send message"
              >
                <Send className="w-5 h-5" />
              </button>

              <button
                onClick={isListening ? stopListening : startListening}
                className={`h-[48px] w-[48px] rounded-xl flex-shrink-0 flex items-center justify-center transition-all duration-200 relative ${
                  isListening
                    ? "bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg hover:shadow-red-500/25"
                    : "bg-white/20 dark:bg-gray-800/40 hover:bg-white/30 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400 border border-gray-200/20 dark:border-gray-700/20"
                }`}
                aria-label={isListening ? "Click to stop voice input" : "Click to start voice input"}
                title={isListening ? "🎤 Listening... Click to stop" : "🎤 Click to start voice input"}
              >
                <Mic className={`w-5 h-5 ${isListening ? 'animate-pulse' : ''}`} />
                {isListening && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-ping"></div>
                )}
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {settingsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-center p-4"
            style={{ 
              alignItems: 'flex-end',
              paddingBottom: '84px' // Height of input area + padding
            }}
            onClick={() => setSettingsOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-2xl bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-5 border-b border-gray-200/20 dark:border-gray-700/20">
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">Settings</h3>
                
                {/* Tabs */}
                <div className="flex gap-1 mt-4 bg-gray-100/50 dark:bg-gray-900/50 rounded-lg p-1">
                    <button
                    onClick={() => setSettingsTab("general")}
                    className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                      settingsTab === "general"
                        ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                    }`}
                  >
                    General
                  </button>
                  <button
                    onClick={() => setSettingsTab("models")}
                    className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                      settingsTab === "models"
                        ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                    }`}
                  >
                    Models
                    </button>
                  </div>
                </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-5">
                {settingsTab === "general" && (
                  <div className="space-y-6">
                {/* Temperature */}
                <div className="space-y-2">
                  <label htmlFor="temperature" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Temperature: {userSettings.temperature.toFixed(1)}
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Deterministic</span>
                    <input
                      id="temperature"
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                          value={userSettings.temperature}
                          onChange={(e) => {
                            const updatedSettings = { ...userSettings, temperature: Number.parseFloat(e.target.value) }
                            onSaveSettings(updatedSettings)
                          }}
                      className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500"
                    />
                    <span className="text-xs text-gray-500 dark:text-gray-400">Creative</span>
                  </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Controls randomness in AI responses. Lower values are more focused, higher values are more creative.
                      </p>
                </div>
                  </div>
                )}

                {settingsTab === "models" && (
                  <div className="space-y-6">
                    {/* OpenRouter Toggle */}
                    <div className="p-4 border border-gray-200/50 dark:border-gray-700/50 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">OpenRouter Mode</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Use OpenRouter to access multiple models with one API key</p>
                        </div>
                    <button
                          onClick={() => handleToggleOpenRouter(!userSettings.openrouterEnabled)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            userSettings.openrouterEnabled ? "bg-purple-500" : "bg-gray-200 dark:bg-gray-700"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              userSettings.openrouterEnabled ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                    </button>
                      </div>
                      
                      {userSettings.openrouterEnabled && (
                        <div className="space-y-3 pt-3 border-t border-gray-200/50 dark:border-gray-700/50">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              OpenRouter API Key
                            </label>
                            <input
                              type="password"
                              value={userSettings.openrouterApiKey}
                              onChange={(e) => {
                                const updatedSettings = { ...userSettings, openrouterApiKey: e.target.value }
                                onSaveSettings(updatedSettings)
                              }}
                              className="w-full p-2 rounded-lg bg-white/50 dark:bg-gray-900/50 border border-gray-200/50 dark:border-gray-700/50 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                              placeholder="sk-or-..."
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Model Name
                            </label>
                            <input
                              type="text"
                              value={userSettings.openrouterModelName}
                              onChange={(e) => {
                                const updatedSettings = { ...userSettings, openrouterModelName: e.target.value }
                                onSaveSettings(updatedSettings)
                              }}
                              className="w-full p-2 rounded-lg bg-white/50 dark:bg-gray-900/50 border border-gray-200/50 dark:border-gray-700/50 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                              placeholder="anthropic/claude-3-opus"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {!userSettings.openrouterEnabled && (
                      <>
                        {/* Add New Model */}
                        <div className="p-4 border border-gray-200/50 dark:border-gray-700/50 rounded-lg">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Add New Model</h4>
                          
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Provider
                              </label>
                              <select
                                value={newModelProvider}
                                onChange={(e) => setNewModelProvider(e.target.value as any)}
                                className="w-full p-2 rounded-lg bg-white/50 dark:bg-gray-900/50 border border-gray-200/50 dark:border-gray-700/50 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                              >
                                <option value="openai">OpenAI</option>
                                <option value="claude">Anthropic (Claude)</option>
                                <option value="gemini">Google (Gemini + VEO2)</option>
                                <option value="deepseek">DeepSeek</option>
                                <option value="grok">Grok (xAI)</option>
                                <option value="openrouter">OpenRouter</option>
                              </select>
                            </div>

                            {newModelProvider === "openrouter" && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Model Name
                                </label>
                                <input
                                  type="text"
                                  value={newModelCustomName}
                                  onChange={(e) => setNewModelCustomName(e.target.value)}
                                  className="w-full p-2 rounded-lg bg-white/50 dark:bg-gray-900/50 border border-gray-200/50 dark:border-gray-700/50 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                  placeholder="anthropic/claude-3-opus"
                                />
                              </div>
                            )}

                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                API Key
                              </label>
                              <div className="relative">
                                <input
                                  type={showNewModelApiKey ? "text" : "password"}
                                  value={newModelApiKey}
                                  onChange={(e) => setNewModelApiKey(e.target.value)}
                                  className="w-full p-2 pr-10 rounded-lg bg-white/50 dark:bg-gray-900/50 border border-gray-200/50 dark:border-gray-700/50 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                  placeholder="Enter API key"
                                />
                    <button
                                  type="button"
                                  onClick={() => setShowNewModelApiKey(!showNewModelApiKey)}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                                >
                                  {showNewModelApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>

                            <button
                              onClick={handleAddModel}
                              className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                            >
                              Add Model
                            </button>
                          </div>
                        </div>

                        {/* Configured Models */}
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Your Models</h4>
                          <div className="space-y-3">
                            {(() => {
                              // Get list of configured providers based on API keys
                              type ConfiguredProvider = {
                                provider: string
                                name: string
                                enabledModels: string[]
                                allModels: Array<{ id: string; name: string; description: string }>
                              }
                              
                              const configuredProviders: ConfiguredProvider[] = []
                              
                              Object.entries(modelLibrary).forEach(([provider, providerData]) => {
                                const apiKeyField = `${provider}ApiKey` as keyof UserSettings
                                const hasApiKey = userSettings[apiKeyField] as string
                                const enabledModels = userSettings.enabledSubModels[provider] || []
                                
                                if (hasApiKey) {
                                  configuredProviders.push({
                                    provider,
                                    name: providerData.name,
                                    enabledModels,
                                    allModels: providerData.models
                                  })
                                }
                              })
                              
                              return configuredProviders.length === 0 ? (
                                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                                  No models configured yet. Add your first model above.
                                </p>
                              ) : (
                                configuredProviders.map((config) => (
                                  <div
                                    key={config.provider}
                                    className="p-4 bg-white/50 dark:bg-gray-900/50 rounded-lg border border-gray-200/50 dark:border-gray-700/50"
                                  >
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                                          {config.provider.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                          <div className="font-medium text-gray-900 dark:text-gray-100">{config.name}</div>
                                          <div className="text-sm text-gray-500 dark:text-gray-400">
                                            {config.enabledModels.length} of {config.allModels.length} models enabled
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => handleEditProvider(config.provider)}
                                          className="px-3 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                                        >
                                          Edit Models
                                        </button>
                                        <button
                                          onClick={() => handleRemoveModel(config.provider)}
                                          className="p-1 text-red-500 hover:text-red-600 transition-colors"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                    
                                    {/* Show enabled models */}
                                    {config.enabledModels.length > 0 && (
                                      <div className="flex flex-wrap gap-2">
                                        {config.enabledModels.map((modelId: string) => {
                                          const model = config.allModels.find((m: { id: string; name: string; description: string }) => m.id === modelId)
                                          return model ? (
                                            <span
                                              key={modelId}
                                              className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full"
                                            >
                                              {model.name}
                                            </span>
                                          ) : null
                                        })}
                                      </div>
                                    )}
                                    
                                    {/* Model selection interface when editing */}
                                    {editingProvider === config.provider && (
                                      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200/50 dark:border-gray-700/50">
                                        <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Select Models to Enable</h5>
                                        <div className="space-y-2 mb-3">
                                          {config.allModels.map((model: { id: string; name: string; description: string }) => {
                                            const isSelected = (tempSelectedModels[config.provider] || []).includes(model.id)
                                            return (
                                              <label
                                                key={model.id}
                                                className="flex items-start gap-3 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700/50 cursor-pointer"
                                              >
                                                <input
                                                  type="checkbox"
                                                  checked={isSelected}
                                                  onChange={() => handleToggleSubModel(config.provider, model.id)}
                                                  className="mt-1 w-4 h-4 text-purple-500 border-gray-300 dark:border-gray-600 rounded focus:ring-purple-500"
                                                />
                                                <div className="flex-1">
                                                  <div className="font-medium text-gray-900 dark:text-gray-100">{model.name}</div>
                                                  <div className="text-sm text-gray-500 dark:text-gray-400">{model.description}</div>
                                                </div>
                                              </label>
                                            )
                                          })}
                                        </div>
                                        <div className="flex gap-2">
                                          <button
                                            onClick={() => handleSaveModelSelection(config.provider)}
                                            className="px-3 py-1 text-sm bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
                                          >
                                            Save
                                          </button>
                                          <button
                                            onClick={handleCancelModelSelection}
                                            className="px-3 py-1 text-sm bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))
                              )
                            })()}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-5 border-t border-gray-200/20 dark:border-gray-700/20 flex justify-end gap-3">
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="px-4 py-2 rounded-lg border border-gray-200/50 dark:border-gray-700/50 text-gray-700 dark:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveGeneralSettings}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium shadow-lg hover:shadow-purple-500/25 transition-all"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
