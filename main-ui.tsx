"use client"

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { formatFileSize } from "@/lib/file-utils"
import ModelLogo from "@/components/model-logos"
import HTMLPreview from "@/components/html-preview"
import VideoPreview from "@/components/video-preview"
import ImagePreview from "@/components/image-preview"
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
  Trash2,
  Save,
  ExternalLink,
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
  searchResults?: Array<{
    title: string
    url: string
    snippet: string
    timestamp: string
  }>
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
  previewUrl?: string
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
  provider: "openai" | "claude" | "gemini" | "deepseek" | "grok" | "openrouter" | "veo2" | "mistral" | "runway"
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
  mistralApiKey: string
  runwayApiKey: string
  enabledSubModels: { [provider: string]: string[] } // Track which sub-models are enabled per provider
  selectedTheme?: string // Currently selected theme
}

type Theme = {
  id: string
  name: string
  description: string
  preview: string // Preview color or gradient
}

type MainUIProps = {
  conversations?: Conversation[]
  projects?: Project[]
  models?: Model[]
  currentConversation?: Conversation
  currentModel?: string
  userSettings?: UserSettings
  isTyping?: boolean
  onSendMessage?: (message: string, attachments?: ProcessedFile[], webSearchEnabled?: boolean, codeGenerationEnabled?: boolean, userLocation?: string | null, enhancedWebSearch?: boolean) => void
  onSelectConversation?: (id: string) => void
  onSelectModel?: (id: string) => void
  onCreateConversation?: () => void
  onCreateProject?: () => void
  onSelectProject?: (projectId: string | null) => void
  onRenameProject?: (id: string, newName: string) => void
  onDeleteProject?: (id: string) => void
  onMoveConversation?: (conversationId: string, projectId: string | null) => void
  onToggleTheme?: () => void
  onLogout?: () => void
  onLogin?: () => void
  isAuthenticated?: boolean
  user?: any
  authLoading?: boolean
  selectedProjectId?: string | null
  onSaveSettings?: (settings: any) => void
  onRenameConversation?: (id: string, newTitle: string) => void
  onDeleteConversation?: (id: string) => void
  onRetryMessage?: (messageId: string, selectedModelId?: string) => void
  onExpandedProjectsChange?: (expandedProjects: Record<string, boolean>) => void
}

// Define icon map for models
const iconMap: { [key: string]: { [key: string]: string } } = {
  openai: {
    "o3": "O3",
    "gpt-4.5": "45",
    "gpt-4.1": "41",
    "gpt-4o": "4O",
    "gpt-4": "G4",
    "gpt-3.5-turbo": "35"
  },
  claude: {
    "claude-4-sonnet": "C4",
    "claude-3.5-opus": "CO",
    "claude-3.5-sonnet": "35"
  },
  gemini: {
    "gemini-2.5-flash": "2F",
    "gemini-2.5-pro": "2P",
    "veo2": "V2"
  },
  deepseek: {
    "deepseek-v3": "D3"
  },
  grok: {
    "grok-3": "G3"
  },
  mistral: {
    "mistral-large": "ML",
    "mistral-medium": "MM",
    "mistral-small": "MS",
    "codestral": "CS"
  },
  openrouter: {
    "openai/gpt-4o-mini": "4M",
    "openai/gpt-4.1-2025-04-14": "41",
    "openai/gpt-4-turbo": "4T",
    "openai/gpt-4": "G4",
    "openai/gpt-3.5-turbo": "35",
    "anthropic/claude-4-sonnet-20250522": "C4",
    "anthropic/claude-3.7-sonnet": "37",
    "anthropic/claude-3-opus": "CO",
    "anthropic/claude-3-sonnet": "CS",
    "anthropic/claude-2.1": "C2",
    "meta-llama/llama-3.3-70b-instruct": "L3",
    "meta-llama/llama-3-70b-chat": "L3",
    "meta-llama/llama-2-70b-chat": "L2",
    "mistral/mistral-large": "ML",
    "mistral/mistral-medium": "MM",
    "mistral/mistral-small": "MS",
    "google/gemini-2.5-flash-preview-05-20": "25",
    "google/gemini-2.0-flash-001": "20",
    "google/gemini-pro": "GP",
    "deepseek/deepseek-r1:free": "DS",
    "x-ai/grok-3-beta": "G3",
    "custom": "CM"
  }
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
    mistralApiKey: "",
    runwayApiKey: "",
    enabledSubModels: {}
  },
  isTyping = false,
  onSendMessage = () => {},
  onSelectConversation = () => {},
  onSelectModel = () => {},
  onCreateConversation = () => {},
  onCreateProject = () => {},
  onSelectProject = () => {},
  onRenameProject = () => {},
  onDeleteProject = () => {},
  onMoveConversation = () => {},
  onToggleTheme = () => {},
  onLogout = () => {},
  onLogin = () => {},
  isAuthenticated = false,
  user = null,
  authLoading = false,
  selectedProjectId = null,
  onSaveSettings = () => {},
  onRenameConversation = () => {},
  onDeleteConversation = () => {},
  onRetryMessage = () => {},
  onExpandedProjectsChange = () => {},
}: MainUIProps) {
  // Comprehensive model library with latest versions
  const modelLibrary = {
    openai: {
      name: "OpenAI",
      models: [
        { id: "o3", name: "o3", description: "Latest breakthrough reasoning model" },
        { id: "gpt-4.5", name: "GPT-4.5", description: "Enhanced flagship model with improved capabilities" },
        { id: "gpt-4.1", name: "GPT-4.1", description: "Latest flagship model with enhanced capabilities" },
        { id: "gpt-4o", name: "GPT-4o", description: "Multimodal model with vision and audio" },
        { id: "gpt-4", name: "GPT-4", description: "Previous generation model" },
        { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", description: "Fast and cost-effective" }
      ]
    },
    claude: {
      name: "Anthropic (Claude)",
      models: [
        { id: "claude-4-sonnet", name: "Claude 4 Sonnet", description: "Latest generation with advanced reasoning" },
        { id: "claude-3.5-opus", name: "Claude 3.5 Opus", description: "Most powerful model for complex tasks" },
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
        { id: "deepseek-v3", name: "DeepSeek V3", description: "Latest reasoning and coding model" }
      ]
    },
    grok: {
      name: "Grok",
      models: [
        { id: "grok-3", name: "Grok 3", description: "Advanced reasoning with real-time data" }
      ]
    },
    mistral: {
      name: "Mistral AI",
      models: [
        { id: "mistral-large", name: "Mistral Large", description: "Most capable model for complex reasoning" },
        { id: "mistral-medium", name: "Mistral Medium", description: "Balanced performance and cost" },
        { id: "mistral-small", name: "Mistral Small", description: "Fast and efficient for simple tasks" },
        { id: "codestral", name: "Codestral", description: "Specialized coding and development model" }
      ]
    },
    runway: {
      name: "RunwayML",
      models: [
        { id: "gen3a-turbo", name: "Gen3 Alpha Turbo", description: "Fast image and video generation" },
        { id: "gen3a", name: "Gen3 Alpha", description: "High-quality image and video generation" },
        { id: "gen2", name: "Gen2", description: "Previous generation model" }
      ]
    },
    openrouter: {
      name: "OpenRouter",
      models: [
        // OpenAI Models via OpenRouter
        { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", description: "Compact version of GPT-4o" },
        { id: "openai/gpt-4.1-2025-04-14", name: "GPT-4.1", description: "Latest OpenAI flagship model" },
        { id: "openai/gpt-4-turbo", name: "GPT-4 Turbo", description: "Powerful OpenAI model" },
        { id: "openai/gpt-4", name: "GPT-4", description: "OpenAI's reliable model" },
        { id: "openai/gpt-3.5-turbo", name: "GPT-3.5 Turbo", description: "Fast and efficient OpenAI model" },
        // Anthropic Models via OpenRouter
        { id: "anthropic/claude-4-sonnet-20250522", name: "Claude 4 Sonnet", description: "Latest Claude model" },
        { id: "anthropic/claude-3.7-sonnet", name: "Claude 3.7 Sonnet", description: "Advanced Claude model" },
        { id: "anthropic/claude-3-opus", name: "Claude 3 Opus", description: "Powerful Claude model" },
        { id: "anthropic/claude-3-sonnet", name: "Claude 3 Sonnet", description: "Balanced Claude model" },
        { id: "anthropic/claude-2.1", name: "Claude 2.1", description: "Previous generation Claude" },
        // Meta Models via OpenRouter
        { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B", description: "Meta's latest open model" },
        { id: "meta-llama/llama-3-70b-chat", name: "Llama 3 70B", description: "Meta's powerful open model" },
        { id: "meta-llama/llama-2-70b-chat", name: "Llama 2 70B", description: "Previous generation Llama" },
        // Mistral Models via OpenRouter
        { id: "mistral/mistral-large", name: "Mistral Large", description: "Mistral's most capable model" },
        { id: "mistral/mistral-medium", name: "Mistral Medium", description: "Balanced Mistral model" },
        { id: "mistral/mistral-small", name: "Mistral Small", description: "Efficient Mistral model" },
        // Google Models via OpenRouter
        { id: "google/gemini-2.5-flash-preview-05-20", name: "Gemini 2.5 Flash Preview", description: "Latest Gemini model" },
        { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash", description: "Fast Gemini model" },
        { id: "google/gemini-pro", name: "Gemini Pro", description: "Google's advanced model" },
        // DeepSeek Models via OpenRouter
        { id: "deepseek/deepseek-r1:free", name: "DeepSeek R1", description: "DeepSeek's advanced model" },
        // xAI Models via OpenRouter
        { id: "x-ai/grok-3-beta", name: "Grok 3 Beta", description: "xAI's advanced reasoning model" },
        // Custom Model Placeholder
        { id: "custom", name: "Custom Model", description: "Add your own model" }
      ]
    }
  }

  // Helper function to get model icons
  const getModelIcon = (provider: string, modelId: string): string => {
    if (provider === 'openrouter') {
      return iconMap.openrouter[modelId] || 'AI'
    }
    
    return iconMap[provider]?.[modelId] || 'AI'
  }

  // Theme library - easily expandable for future themes
  // Each theme supports both light and dark modes via the header toggle
  const themeLibrary: Theme[] = [
    {
      id: "basic",
      name: "Basic",
      description: "Clean and modern theme with minimal design",
      preview: "linear-gradient(135deg, #000000 0%, #333333 100%)"
    },
    {
      id: "notebook",
      name: "Notebook",
      description: "Handwritten notebook style with Architects Daughter font",
      preview: "linear-gradient(135deg, #f8f6f4 0%, #e8e2db 100%)"
    },
    {
      id: "t3",
      name: "T3",
      description: "Modern theme with OKLCH color system and refined UI elements",
      preview: "linear-gradient(135deg, oklch(0.9754 0.0084 325.6414) 0%, oklch(0.3257 0.1161 325.0372) 100%)"
    }
  ]

  // State
  const [theme, setTheme] = useState<"dark" | "light">("dark")
  const [currentTheme, setCurrentTheme] = useState<string>("basic")
  
  // Initialize theme based on current document classes and saved preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        // Check for saved theme preference
        const savedTheme = userSettings.selectedTheme || 'basic'
        console.log('Initializing theme:', {
          savedTheme,
          currentClasses: Array.from(document.documentElement.classList),
          userSettings
        })
        setCurrentTheme(savedTheme)
        
        // Add font preload for notebook theme
        if (savedTheme === 'notebook') {
          if (!document.getElementById('notebook-font-preload')) {
            const fontLink = document.createElement('link')
            fontLink.href = 'https://fonts.googleapis.com/css2?family=Architects+Daughter&display=swap'
            fontLink.rel = 'stylesheet'
            fontLink.id = 'notebook-font-preload'
            document.head.appendChild(fontLink)
          }
        }
        
        // Check for saved light/dark preference
        const savedThemeMode = localStorage.getItem('t3-chat-theme-mode')
        let actualThemeMode = savedThemeMode
        
        if (savedThemeMode === 'light') {
          setTheme('light')
        } else if (savedThemeMode === 'dark') {
          setTheme('dark')
        } else {
          // Default to dark mode
          setTheme('dark')
          actualThemeMode = 'dark'
          localStorage.setItem('t3-chat-theme-mode', 'dark')
        }
        
        // Apply the saved theme class
        const themeClasses = ['theme-basic', 'theme-notebook', 'theme-t3']
        document.documentElement.classList.remove(...themeClasses, 'light', 'dark')
        document.documentElement.classList.add(`theme-${savedTheme}`)
        
        // Apply light/dark mode class
        if (actualThemeMode === 'light') {
          document.documentElement.classList.add('light')
        } else if (savedTheme === 'basic' || savedTheme === 't3') {
          document.documentElement.classList.add('dark')
        }
        
        // Debug logging
        console.log('Theme initialized:', {
          selectedTheme: savedTheme,
          lightDarkMode: actualThemeMode,
          documentClasses: Array.from(document.documentElement.classList)
        })
      } catch (error) {
        console.error('Error initializing theme:', error)
      }
    }
  }, [userSettings.selectedTheme])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)

  const [settingsTab, setSettingsTab] = useState<"general" | "models" | "themes">("general")
  const [newModelProvider, setNewModelProvider] = useState<"openai" | "claude" | "gemini" | "deepseek" | "grok" | "openrouter" | "mistral" | "runway">("openai")
  const [newModelApiKey, setNewModelApiKey] = useState("")
  const [newModelCustomName, setNewModelCustomName] = useState("")
  const [showNewModelApiKey, setShowNewModelApiKey] = useState(false)
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState("")
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [editingProjectName, setEditingProjectName] = useState("")
  const [draggedConversationId, setDraggedConversationId] = useState<string | null>(null)
  const [dragOverProjectId, setDragOverProjectId] = useState<string | null>(null)
  const [editingProvider, setEditingProvider] = useState<string | null>(null) // Track which provider is being edited
  const [tempSelectedModels, setTempSelectedModels] = useState<{ [provider: string]: string[] }>({}) // Temporary selection during editing

  // File upload state
  const [attachments, setAttachments] = useState<ProcessedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  // Web search state
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)
  const [enhancedWebSearch, setEnhancedWebSearch] = useState(false)
  const [codeGenerationEnabled, setCodeGenerationEnabled] = useState(false)
  const [userLocation, setUserLocation] = useState<string | null>(null)
  const [locationPermission, setLocationPermission] = useState<"granted" | "denied" | "prompt">("prompt")

  // Code generation state
  const [isListening, setIsListening] = useState(false)

  // OpenRouter-specific state
  const [openrouterSelectedModels, setOpenrouterSelectedModels] = useState<string[]>([])
  const [openrouterCustomModels, setOpenrouterCustomModels] = useState<Array<{id: string, name: string}>>([])
  const [newCustomModel, setNewCustomModel] = useState({ id: '', name: '' })

  // Use models from props (calculated in page.tsx with proper API key logic)
  const availableModels = useMemo(() => {
    if (userSettings.openrouterEnabled) {
      // When OpenRouter is enabled, show only selected OpenRouter models
      const selectedModels = openrouterSelectedModels.map(modelId => {
        // Check if it's a custom model
        const customModel = openrouterCustomModels.find(m => m?.id === modelId)
        if (customModel) {
          return {
            id: customModel.id,
            name: customModel.name,
            provider: 'openrouter' as const,
            icon: 'CM'
          }
        }
        // Otherwise find it in the OpenRouter model library
        const libraryModel = modelLibrary.openrouter.models.find(m => m?.id === modelId)
        if (libraryModel) {
          return {
            id: libraryModel.id,
            name: libraryModel.name,
            provider: 'openrouter' as const,
            icon: getModelIcon('openrouter', libraryModel.id)
          }
        }
        return null
      }).filter((model): model is NonNullable<typeof model> => model !== null)

      return selectedModels
    } else {
      // When OpenRouter is disabled, show models based on API keys
      return models
    }
  }, [userSettings.openrouterEnabled, openrouterSelectedModels, openrouterCustomModels, models])

  // Comprehensive model library for display purposes (includes all models, not just available ones)
  const allModelsLibrary: Model[] = [
    // OpenAI Models
    { id: "o3", name: "o3", icon: "O3", provider: "openai" },
    { id: "gpt-4.5", name: "GPT-4.5", icon: "45", provider: "openai" },
    { id: "gpt-4.1", name: "GPT-4.1", icon: "41", provider: "openai" },
    { id: "gpt-4", name: "GPT-4", icon: "G4", provider: "openai" },
    { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", icon: "35", provider: "openai" },
    
    // Claude Models
    { id: "claude-4-sonnet", name: "Claude 4 Sonnet", icon: "C4", provider: "claude" },
    { id: "claude-3.5-opus", name: "Claude 3.5 Opus", icon: "CO", provider: "claude" },
    { id: "claude-3.5-sonnet", name: "Claude 3.5 Sonnet", icon: "C3", provider: "claude" },
    
    // Gemini Models
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", icon: "G2", provider: "gemini" },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", icon: "GP", provider: "gemini" },
    { id: "veo2", name: "VEO 2", icon: "V2", provider: "veo2" },
    
    // DeepSeek Models
    { id: "deepseek-v3", name: "DeepSeek V3", icon: "D3", provider: "deepseek" },
    
    // Grok Models
    { id: "grok-3", name: "Grok 3", icon: "G3", provider: "grok" },
    
    // Mistral Models
    { id: "mistral-large", name: "Mistral Large", icon: "ML", provider: "mistral" },
    { id: "mistral-medium", name: "Mistral Medium", icon: "MM", provider: "mistral" },
    { id: "mistral-small", name: "Mistral Small", icon: "MS", provider: "mistral" },
    { id: "codestral", name: "Codestral", icon: "CS", provider: "mistral" }
  ]

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<any>(null)
  const profileDropdownRef = useRef<HTMLDivElement>(null)

  // State for scroll behavior
  const [isUserScrolling, setIsUserScrolling] = useState(false)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  // Check if current model supports web search
  const isWebSearchCompatible = () => {
    const currentModelData = availableModels.find(m => m.id === currentModel)
    return currentModelData && (currentModelData.provider === "gemini" || currentModelData.provider === "grok")
  }

  // Check if current model supports code generation (hide for VEO2 since it's a video model, and DeepSeek due to timeout issues)
  const isCodeGenerationCompatible = () => {
    const currentModelData = availableModels.find(m => m.id === currentModel)
    return currentModelData && currentModelData.id !== "veo2" && currentModelData.provider !== "deepseek"
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

  // Disable web search when switching to incompatible models
  useEffect(() => {
    if (!isWebSearchCompatible() && webSearchEnabled) {
      setWebSearchEnabled(false)
    }
  }, [currentModel])

  // Disable code generation when switching to incompatible models (like VEO2)
  useEffect(() => {
    if (!isCodeGenerationCompatible() && codeGenerationEnabled) {
      setCodeGenerationEnabled(false)
    }
  }, [currentModel])

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false)
      }
    }

    if (profileDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [profileDropdownOpen])

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    if (!file) return

    // Create a temporary attachment object for loading state
    const tempAttachment = {
      id: 'temp-' + Date.now(),
      name: file.name,
      type: file.type,
      size: file.size,
      uploadedAt: new Date().toISOString()
    }

    // Add the temporary attachment to show loading state
    setAttachments(prev => [...prev, tempAttachment])
    setIsUploading(true)
    setError(null)

    try {
      // Validate file type
      const isImage = file.type.startsWith('image/')
      const isPDF = file.type === 'application/pdf'
      
      if (!isImage && !isPDF) {
        throw new Error('Only images and PDFs are supported')
      }

      // Validate image format if it's an image
      if (isImage) {
        const allowedFormats = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        if (!allowedFormats.includes(file.type)) {
          throw new Error('Only JPG, PNG, GIF, and WebP images are supported')
        }
        
        // Validate image size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          throw new Error('Image size must be less than 10MB')
        }
      }

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

      // Create a preview URL for images
      if (isImage) {
        result.file.previewUrl = URL.createObjectURL(file)
      }

      // Replace the temporary attachment with the processed one
      setAttachments(prev => prev.map(att => 
        att.id === tempAttachment.id ? result.file : att
      ))
    } catch (error) {
      console.error('Upload error:', error)
      // Remove the temporary attachment on error
      setAttachments(prev => prev.filter(att => att.id !== tempAttachment.id))
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

  // Request user location for more relevant search results
  const requestLocationPermission = async () => {
    try {
      if (!navigator.geolocation) {
        console.log("Geolocation not supported");
        setLocationPermission("denied");
        return;
      }
      
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          (error) => {
            console.log("Geolocation permission denied or error:", error);
            setLocationPermission("denied");
            reject(error);
          },
          {
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 300000 // 5 minutes
          }
        );
      });
      
      // Get approximate location name using reverse geocoding
      try {
        const { latitude, longitude } = position.coords;
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        // Extract country code or state
        let locationString = "US"; // Default fallback
        if (data.address) {
          if (data.address.country_code) {
            locationString = data.address.country_code.toUpperCase();
          }
          if (data.address.state) {
            locationString = `${data.address.state}, ${locationString}`;
          }
        }
        
        setUserLocation(locationString);
        setLocationPermission("granted");
        console.log("Location permission granted:", locationString);
      } catch (error) {
        console.error("Error getting location name:", error);
        // Still set permission to granted since we got coordinates
        setLocationPermission("granted");
        setUserLocation(null);
      }
    } catch (error) {
      // This catches both geolocation errors and promise rejections
      console.error("Error getting location:", error);
      setLocationPermission("denied");
      setUserLocation(null);
    }
  };

  // Toggle web search function with enhanced option
  const toggleWebSearch = () => {
    if (!webSearchEnabled) {
      // If enabling search and location permission is still prompt, ask for it
      if (locationPermission === "prompt") {
        const shouldRequestLocation = window.confirm(
          "Would you like to share your approximate location to get more relevant search results? " +
          "This will help filter content based on your region."
        );
        
        if (shouldRequestLocation) {
          requestLocationPermission();
        } else {
          setLocationPermission("denied");
        }
      }
      // Disable code generation if it's enabled
      if (codeGenerationEnabled) {
        setCodeGenerationEnabled(false);
      }
      // Enable web search with enhanced mode by default
      setWebSearchEnabled(true);
      setEnhancedWebSearch(true);
    } else if (webSearchEnabled && enhancedWebSearch) {
      // Toggle to basic search mode (no content extraction)
      setEnhancedWebSearch(false);
    } else {
      // Turn off web search completely
      setWebSearchEnabled(false);
      setEnhancedWebSearch(false);
    }
  };

  // Handle code generation toggle
  const handleCodeGenerationToggle = () => {
    if (!codeGenerationEnabled) {
      // Disable web search if it's enabled
      if (webSearchEnabled) {
        setWebSearchEnabled(false);
        setEnhancedWebSearch(false);
      }
      setCodeGenerationEnabled(true);
    } else {
      setCodeGenerationEnabled(false);
    }
  };

  // Handle sending a message
  const handleSendMessage = () => {
    if (inputValue.trim() || attachments.length > 0) {
      // Pass userLocation with the message when web search is enabled
      onSendMessage(
        inputValue, 
        attachments.length > 0 ? attachments : undefined, 
        webSearchEnabled, 
        codeGenerationEnabled,
        webSearchEnabled ? userLocation : null,
        enhancedWebSearch // Pass enhanced search flag
      );
      setInputValue("");
      setAttachments([]);
      
      // Scroll to bottom after sending
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
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
      handleSaveRename()
    } else if (e.key === "Escape") {
      handleCancelRename()
    }
  }

  // Toggle project expansion
  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => {
      const newExpandedProjects = {
        ...prev,
        [projectId]: !prev[projectId],
      }
      return newExpandedProjects
    })
  }

  // Effect to handle expanded projects change callback
  useEffect(() => {
    onExpandedProjectsChange?.(expandedProjects)
  }, [expandedProjects, onExpandedProjectsChange])

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
        case "mistral":
          updatedSettings.mistralApiKey = newModelApiKey
          break
        case "runway":
          updatedSettings.runwayApiKey = newModelApiKey
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
      case "mistral":
        updatedSettings.mistralApiKey = ""
        break
      case "runway":
        updatedSettings.runwayApiKey = ""
        break
    }
    
    // Clear enabled sub-models for the provider
    updatedSettings.enabledSubModels = {
      ...updatedSettings.enabledSubModels,
      [provider]: []
    }
    
    onSaveSettings(updatedSettings)
  }

  // Update handleToggleOpenRouter function
  const handleToggleOpenRouter = (enabled: boolean) => {
    console.log("[DEBUG UI] Toggling OpenRouter mode:", enabled);
    
    const updatedSettings = {
      ...userSettings,
      openrouterEnabled: enabled
    }
    
    if (enabled) {
      // When enabling OpenRouter, set a default model if none is selected
      const defaultModel = "anthropic/claude-3.7-sonnet";
      console.log("[DEBUG UI] Setting default OpenRouter model:", defaultModel);
      updatedSettings.openrouterModelName = defaultModel;
      
      // Also select this model in the UI
      setTimeout(() => {
        console.log("[DEBUG UI] Auto-selecting default model after toggle");
        onSelectModel(defaultModel);
      }, 100);
    }
    
    console.log("[DEBUG UI] Saving updated settings with OpenRouter", enabled ? "enabled" : "disabled");
    onSaveSettings(updatedSettings)
  }

  // Save general settings
  const handleSaveGeneralSettings = () => {
    const updatedSettings = {
      ...userSettings,
      temperature: userSettings.temperature,
      openrouterModelName: openrouterSelectedModels[0] || userSettings.openrouterModelName
    }
    onSaveSettings(updatedSettings)
    setSettingsOpen(false)
  }

  // Toggle theme
  const toggleTheme = () => {
    try {
      const newTheme = theme === "dark" ? "light" : "dark"
      setTheme(newTheme)
      onToggleTheme()
      
      // Save preference to localStorage
      localStorage.setItem('t3-chat-theme-mode', newTheme)
      
      // Remove both light and dark classes, then add the appropriate one
      document.documentElement.classList.remove("light", "dark")
      
      if (newTheme === "light") {
        document.documentElement.classList.add("light")
      } else {
        // For dark mode, add 'dark' class for basic and t3 themes
        // Notebook theme uses .theme-notebook alone for dark mode
        if (currentTheme === "basic" || currentTheme === "t3") {
          document.documentElement.classList.add("dark")
        }
      }
      
      // Debug logging
      console.log('Theme toggled:', {
        newTheme,
        currentTheme,
        documentClasses: Array.from(document.documentElement.classList)
      })
      
      // TEMPORARY DIRECT STYLE APPLICATION for notebook theme debugging
      if (currentTheme === 'notebook') {
        if (newTheme === 'light') {
          document.body.style.backgroundColor = '#f9f9f9'
          document.body.style.color = '#333333'
          document.documentElement.style.backgroundColor = '#f9f9f9'
        } else {
          document.body.style.backgroundColor = '#2b2b2b'
          document.body.style.color = '#f0f0f0'
          document.documentElement.style.backgroundColor = '#2b2b2b'
        }
        
        // Apply Architects Daughter font universally using CSS injection
        let fontStyleElement = document.getElementById('notebook-font-style')
        if (!fontStyleElement) {
          fontStyleElement = document.createElement('style')
          fontStyleElement.id = 'notebook-font-style'
          document.head.appendChild(fontStyleElement)
        }
        
        fontStyleElement.textContent = `
          * {
            font-family: "Architects Daughter", sans-serif !important;
          }
          body, html {
            font-family: "Architects Daughter", sans-serif !important;
          }
        `
        
        // Also apply directly to body and html for immediate effect
        document.body.style.fontFamily = '"Architects Daughter", sans-serif'
        document.documentElement.style.fontFamily = '"Architects Daughter", sans-serif'
        
        // Apply different backgrounds for dark mode: sidebar vs chat area
        if (newTheme === 'dark') {
          setTimeout(() => {
            // More specific selectors for sidebar and chat areas
            const sidebar = document.querySelector('.w-64') || document.querySelector('[style*="width: 16rem"]')
            const chatAreas = document.querySelectorAll('main, .flex-1, .min-h-screen > div:last-child')
            
            // Apply sidebar color
            if (sidebar) {
              (sidebar as HTMLElement).style.backgroundColor = '#2b2b2b !important'
              // Also apply to all children to ensure consistency
              const sidebarChildren = sidebar.querySelectorAll('*')
              sidebarChildren.forEach(child => {
                (child as HTMLElement).style.backgroundColor = 'inherit'
              })
            }
            
            // Apply chat area color
            chatAreas.forEach(area => {
              if (area && !area.classList.contains('w-64')) {
                (area as HTMLElement).style.backgroundColor = '#333333 !important'
              }
            })
            
            // Force specific components
            const mainContent = document.querySelector('.flex.h-screen > div:last-child')
            if (mainContent) {
              (mainContent as HTMLElement).style.backgroundColor = '#333333 !important'
            }
          }, 100)
        }
      } else {
        // Reset for basic theme
        document.body.style.backgroundColor = ''
        document.body.style.color = ''
        document.body.style.fontFamily = ''
        document.documentElement.style.backgroundColor = ''
        document.documentElement.style.fontFamily = ''
        
        // Remove the injected font style
        const fontStyleElement = document.getElementById('notebook-font-style')
        if (fontStyleElement) {
          fontStyleElement.remove()
        }
      }
    } catch (error) {
      console.error('Error toggling theme:', error)
    }
  }

  // Handle theme selection
  const handleThemeSelect = (themeId: string) => {
    try {
      setCurrentTheme(themeId)
      
      // Add or remove font preload based on theme
      if (themeId === 'notebook') {
        if (!document.getElementById('notebook-font-preload')) {
          const fontLink = document.createElement('link')
          fontLink.href = 'https://fonts.googleapis.com/css2?family=Architects+Daughter&display=swap'
          fontLink.rel = 'stylesheet'
          fontLink.id = 'notebook-font-preload'
          document.head.appendChild(fontLink)
        }
      } else {
        const fontLink = document.getElementById('notebook-font-preload')
        if (fontLink) {
          fontLink.remove()
        }
      }
      
      // Apply theme-specific classes to document
      const themeClasses = ['theme-basic', 'theme-notebook', 'theme-t3']
      document.documentElement.classList.remove(...themeClasses, 'light', 'dark')
      document.documentElement.classList.add(`theme-${themeId}`)
      
      // Re-apply the current light/dark mode
      if (theme === "light") {
        document.documentElement.classList.add("light")
      } else if (themeId === "basic" || themeId === "t3") {
        document.documentElement.classList.add("dark")
      }
      
      // Save theme preference
      const updatedSettings = { 
        ...userSettings, 
        selectedTheme: themeId 
      }
      onSaveSettings(updatedSettings)
      
      // Debug logging
      console.log('Theme selected:', {
        themeId,
        lightDarkMode: theme,
        documentClasses: Array.from(document.documentElement.classList)
      })
    } catch (error) {
      console.error('Error selecting theme:', error)
    }
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

  // Detect image generation content
  const detectImageContent = (content: string) => {
    // Patterns for image generation detection
    const imagePattern = /🎨.*?Image Generation.*?(Started|Complete|Initiated|Processing|Generated)/i
    const imageUrlPattern = /Image URL:\s*(https?:\/\/[^\s\n]+|data:image\/[^;\s]+;base64,[A-Za-z0-9+/=]+)/gi
    const promptPattern = /\*\*Prompt:\*\*\s*(.+?)(?=\n|$)/i
    const providerPattern = /\*\*Provider:\*\*\s*([^\n]+)/i
    const modelPattern = /\*\*Model:\*\*\s*([^\n]+)/i
    const statusPattern = /\*\*Status:\*\*\s*([^\n]+)/i
    
    const hasImage = imagePattern.test(content) || imageUrlPattern.test(content)
    const promptMatch = content.match(promptPattern)
    const providerMatch = content.match(providerPattern)
    const modelMatch = content.match(modelPattern)
    const statusMatch = content.match(statusPattern)
    
    // Extract all image URLs
    const imageUrls: string[] = []
    let match
    while ((match = imageUrlPattern.exec(content)) !== null) {
      if (match[1]) {
        imageUrls.push(match[1].trim())
      }
    }
    
    // Check if it's currently generating
    const isGenerating = content.includes('Image Generation Started') || 
                        content.includes('Generating Image') ||
                        content.includes('Creating your image') ||
                        (statusMatch && statusMatch[1].toLowerCase().includes('processing'))
    
    return {
      hasImage,
      prompt: promptMatch ? promptMatch[1].trim() : null,
      isGenerating,
      imageUrl: imageUrls.length > 0 ? imageUrls[0] : null, // For backward compatibility
      imageUrls: imageUrls, // New array of all image URLs
      provider: providerMatch ? providerMatch[1].trim() : null,
      model: modelMatch ? modelMatch[1].trim() : null
    }
  }

  // Helper function to safely get hostname from URL
  const getHostnameFromUrl = (url: string): string => {
    try {
      // Check if URL is valid and not empty
      if (!url || typeof url !== 'string') {
        return 'Unknown source';
      }
      
      // Add protocol if missing
      const urlToTest = url.startsWith('http') ? url : `https://${url}`;
      const urlObj = new URL(urlToTest);
      return urlObj.hostname;
    } catch (error) {
      console.warn('Invalid URL:', url);
      return 'Unknown source';
    }
  }

  // Format message content
  const formatMessageContent = (content: string) => {
    // First, extract and preserve code blocks before any other processing
    const codeBlocks: { [key: string]: string } = {};
    let codeBlockCounter = 0;
    
    // Extract HTML and CSS code blocks to preserve them
    let processedContent = content.replace(/```(html|css|javascript|js|jsx|tsx|typescript|ts)\n?([\s\S]*?)```/gi, (match, lang, code) => {
      const placeholder = `__CODE_BLOCK_${codeBlockCounter}__`;
      codeBlocks[placeholder] = match; // Keep original code block intact
      codeBlockCounter++;
      return placeholder;
    });
    
    // Extract any remaining code blocks
    processedContent = processedContent.replace(/```([\w+-]*)\n?([\s\S]*?)```/g, (match, lang, code) => {
      const placeholder = `__CODE_BLOCK_${codeBlockCounter}__`;
      codeBlocks[placeholder] = match; // Keep original code block intact
      codeBlockCounter++;
      return placeholder;
    });

    // Clean up content for minimalist formatting (but preserve code block placeholders)
    const cleaned = processedContent
      // Remove all emojis
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      // Remove excessive hashtags and replace with clean headers
      .replace(/^#{1,6}\s+/gm, '')
      // Clean markdown formatting to HTML
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-sm font-mono">$1</code>')
      // Handle web search results - convert numbered citations with actual links
      .replace(/\[(\d+)\]/g, '<a href="#source-$1" class="text-xs align-super bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1 py-0.5 rounded-sm no-underline hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors cursor-pointer" onclick="scrollToSource($1)">$1</a>')
      // Handle legacy source format  
      .replace(/\[source:\s*(\d+)]/g, '<a href="#source-$1" class="text-xs align-super bg-muted text-muted-foreground px-1 py-0.5 rounded-sm no-underline">$1</a>')
      // Enhanced markdown links handling - make them more prominent for citations
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
        // Check if this looks like a web search result citation
        if (text.match(/^\d+$/) || text.toLowerCase().includes('source') || url.includes('http')) {
          return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline font-medium transition-colors"><span>${text}</span><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg></a>`;
        } else {
          // Regular markdown link
          return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-purple-500 hover:text-purple-700 dark:hover:text-purple-300 hover:underline transition-colors">${text}</a>`;
        }
      })
      // Handle website names that should be clickable (look for common website patterns)
      .replace(/\b([A-Za-z0-9-]+\.(?:com|org|net|edu|gov|co\.uk|io|ai|tech|dev|app))\b/g, '<a href="https://$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline transition-colors">$1</a>')
      // Handle phrases like "According to [Website Name]" and make the website name clickable
      .replace(/\b(according to|source:|from|via|on|at)\s+([A-Z][a-zA-Z\s&]+?)(?=\s*[,.:]|\s*$)/gi, (match, prefix, siteName) => {
        // Only process if it looks like a website name (has capital letters and reasonable length)
        if (siteName.length > 3 && siteName.length < 50 && /[A-Z]/.test(siteName)) {
          const cleanSiteName = siteName.trim().replace(/[,.:;]$/, '');
          // Try to create a reasonable URL from the site name
          const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(cleanSiteName)}`;
          return `${prefix} <a href="${searchUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline font-medium transition-colors">${cleanSiteName}</a>`;
        }
        return match;
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

    // Now restore the code blocks in their original form with proper styling
    let finalContent = cleaned;
    Object.entries(codeBlocks).forEach(([placeholder, originalBlock]) => {
      // Parse the original code block to add proper styling
      const codeBlockMatch = originalBlock.match(/```([\w+-]*)\n?([\s\S]*?)```/);
      if (codeBlockMatch) {
        const [, lang, code] = codeBlockMatch;
        // Escape HTML entities in code to prevent parsing issues
        const escapedCode = code
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;');
        
        // Add language-specific styling
        const languageClass = lang ? `language-${lang.toLowerCase()}` : '';
        const languageLabel = lang ? `<span class="absolute top-2 right-2 text-xs text-muted-foreground bg-muted px-2 py-1 rounded">${lang}</span>` : '';
        
        const styledCodeBlock = `<div class="relative"><pre class="bg-muted p-4 rounded-lg overflow-x-auto my-4 ${languageClass}"><code class="font-mono text-sm">${escapedCode}</code></pre>${languageLabel}</div>`;
        finalContent = finalContent.replace(placeholder, styledCodeBlock);
      }
    });

    return finalContent;
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

  // Check if user is at bottom of messages
  const checkIfAtBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current
      const threshold = 100 // pixels from bottom
      const atBottom = scrollHeight - scrollTop - clientHeight < threshold
      setIsAtBottom(atBottom)
    }
  }, [])

  // Handle scroll events
  const handleScroll = useCallback(() => {
    setIsUserScrolling(true)
    checkIfAtBottom()
    
    // Reset user scrolling flag after a delay
    const timeoutId = setTimeout(() => {
      setIsUserScrolling(false)
    }, 1000)
    
    return () => clearTimeout(timeoutId)
  }, [checkIfAtBottom])

  // Auto-scroll only when user is at bottom and not actively scrolling
  useEffect(() => {
    if (!isUserScrolling && isAtBottom && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [currentConversation.messages, isUserScrolling, isAtBottom])

  // Reset scroll state when conversation changes
  useEffect(() => {
    setIsUserScrolling(false)
    setIsAtBottom(true)
    // Small delay to ensure DOM is updated
    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "auto" })
      }
    }, 100)
  }, [currentConversation.id])
  
  // Auto-resize textarea based on content
  useEffect(() => {
    const adjustTextareaHeight = () => {
      const textarea = chatInputRef.current
      if (textarea) {
        // Reset height to auto to get the correct scrollHeight
        textarea.style.height = 'auto'
        // Set the height to scrollHeight to fit all content
        const newHeight = Math.min(160, Math.max(48, textarea.scrollHeight))
        textarea.style.height = `${newHeight}px`
      }
    }
    
    // Call on mount and when input value changes
    adjustTextareaHeight()
  }, [inputValue])

  // Handle input change with auto-resize
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value)
  }

  const handleStartProjectRename = (projectId: string, currentName: string) => {
    setEditingProjectId(projectId)
    setEditingProjectName(currentName)
  }

  const handleSaveProjectRename = () => {
    if (editingProjectId && editingProjectName.trim()) {
      onRenameProject?.(editingProjectId, editingProjectName.trim())
    }
    setEditingProjectId(null)
    setEditingProjectName("")
  }

  const handleCancelProjectRename = () => {
    setEditingProjectId(null)
    setEditingProjectName("")
  }

  const handleProjectRenameKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveProjectRename()
    } else if (e.key === "Escape") {
      handleCancelProjectRename()
    }
  }

  // Drag and drop handlers for conversations
  const handleConversationDragStart = (e: React.DragEvent, conversationId: string) => {
    setDraggedConversationId(conversationId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleConversationDragEnd = () => {
    setDraggedConversationId(null)
    setDragOverProjectId(null)
  }

  const handleProjectDragOver = (e: React.DragEvent, projectId: string | null) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverProjectId(projectId)
  }

  const handleProjectDragLeave = () => {
    setDragOverProjectId(null)
  }

  const handleProjectDrop = (e: React.DragEvent, projectId: string | null) => {
    e.preventDefault()
    if (draggedConversationId) {
      onMoveConversation?.(draggedConversationId, projectId)
    }
    setDraggedConversationId(null)
    setDragOverProjectId(null)
  }

  // Render message content based on its type
  const renderMessageContent = (message: Message) => {
    // Cache detection results to prevent repetitive calls
    const htmlDetection = detectHTMLInContent(message.content)
    const videoDetection = detectVideoContent(message.content)
    const imageDetection = detectImageContent(message.content)
    
    if (videoDetection.hasVideo) {
      return (
        <div className={`space-y-4 ${message.role === "assistant" ? "flex flex-col items-center text-center" : ""}`}>
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
        <div className={`space-y-4 ${message.role === "assistant" ? "flex flex-col items-center text-center" : ""}`}>
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
            }}
          />
        </div>
      )
    } else if (imageDetection.hasImage) {
      return (
        <div className={`space-y-4 ${message.role === "assistant" ? "flex flex-col items-center text-center" : ""}`}>
          {/* Regular message content */}
          <div 
            className={`prose dark:prose-invert prose-sm max-w-none text-gray-800 dark:text-gray-200 ${
              message.isError ? 'text-red-600 dark:text-red-400' : ''
            }`}
            dangerouslySetInnerHTML={{ 
              __html: formatMessageContent(message.content) 
            }}
          />
          
          {/* Image Preview */}
          <div className="mt-4 flex flex-wrap gap-4 justify-center">
            {imageDetection.imageUrls && imageDetection.imageUrls.map((url: string, index: number) => (
              <div key={`img-${index}`} className="relative group">
                <img 
                  src={url} 
                  alt={`Generated image ${index + 1}`}
                  className="rounded-lg max-h-96 object-contain border border-gray-200/30 dark:border-gray-700/30"
                />
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a 
                    href={url} 
                    download={`generated-image-${Date.now()}-${index}.jpg`}
                    className="bg-black/50 hover:bg-black/70 text-white p-2 rounded-full"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    } else {
      return (
        <div 
          className={`prose dark:prose-invert prose-sm max-w-none text-gray-800 dark:text-gray-200 ${
            message.isError ? 'text-red-600 dark:text-red-400' : ''
          } ${message.role === "assistant" ? "mx-auto" : ""}`}
          dangerouslySetInnerHTML={{ 
            __html: formatMessageContent(message.content) 
          }}
        />
      )
    }
  }

  // Add new function to handle OpenRouter model selection
  const handleOpenrouterModelToggle = (modelId: string) => {
    console.log("[DEBUG UI] Toggling OpenRouter model:", modelId);
    
    setOpenrouterSelectedModels(prev => {
      if (prev.includes(modelId)) {
        // If we're removing the currently selected model, we need to select another one
        if (currentModel === modelId || userSettings.openrouterModelName === modelId) {
          console.log("[DEBUG UI] Removing currently selected model");
          // Find another model to select
          const remainingModels = prev.filter(id => id !== modelId);
          if (remainingModels.length > 0) {
            const newModel = remainingModels[0];
            console.log("[DEBUG UI] Auto-selecting new model:", newModel);
            setTimeout(() => {
              onSelectModel(newModel);
              onSaveSettings({
                ...userSettings,
                openrouterModelName: newModel
              });
            }, 100);
          }
        }
        return prev.filter(id => id !== modelId);
      } else {
        // If this is the first model being added or no model is currently selected, select this one
        const newModels = [...prev, modelId];
        if (!currentModel || !userSettings.openrouterModelName || prev.length === 0) {
          console.log("[DEBUG UI] Auto-selecting newly added model:", modelId);
          setTimeout(() => {
            onSelectModel(modelId);
            onSaveSettings({
              ...userSettings,
              openrouterModelName: modelId
            });
          }, 100);
        }
        return newModels;
      }
    });
  }

  // Add new function to handle custom model addition
  const handleAddCustomModel = () => {
    if (newCustomModel.id && newCustomModel.name) {
      setOpenrouterCustomModels(prev => [...prev, newCustomModel])
      setOpenrouterSelectedModels(prev => [...prev, newCustomModel.id])
      setNewCustomModel({ id: '', name: '' })
    }
  }

  // Update useEffect to initialize selected models from settings
  useEffect(() => {
    console.log("[DEBUG UI] OpenRouter enabled:", userSettings.openrouterEnabled);
    console.log("[DEBUG UI] OpenRouter API key exists:", !!userSettings.openrouterApiKey);
    console.log("[DEBUG UI] Current model:", currentModel);
    
    if (userSettings.openrouterEnabled) {
      // If there's a saved model name, include it in the selected models
      const defaultModels = [
        "google/gemini-2.0-flash-001",
        "anthropic/claude-4-sonnet-20250522",
        "google/gemini-2.5-flash-preview-05-20",
        "anthropic/claude-3.7-sonnet",
        "openai/gpt-4.1-2025-04-14",
        "openai/gpt-4o-mini",
        "deepseek/deepseek-r1:free",
        "x-ai/grok-3-beta",
        "meta-llama/llama-3.3-70b-instruct"
      ]
      
      console.log("[DEBUG UI] Default OpenRouter models:", defaultModels);
      
      // Start with the default models, and add the current model if it's not already included
      const initialModels = new Set(defaultModels)
      if (userSettings.openrouterModelName && !initialModels.has(userSettings.openrouterModelName)) {
        initialModels.add(userSettings.openrouterModelName)
        console.log("[DEBUG UI] Added saved model to selection:", userSettings.openrouterModelName);
      }
      
      console.log("[DEBUG UI] Setting OpenRouter selected models:", Array.from(initialModels));
      setOpenrouterSelectedModels(Array.from(initialModels))
      
      // If no model is currently selected, select the first one
      if (!currentModel || !initialModels.has(currentModel)) {
        const firstModel = Array.from(initialModels)[0]
        if (firstModel) {
          console.log("[DEBUG UI] Auto-selecting first model:", firstModel);
          onSelectModel(firstModel)
        }
      }
    }
  }, [userSettings.openrouterEnabled, userSettings.openrouterModelName, userSettings.openrouterApiKey, currentModel, onSelectModel])

  // Update model selection handler
  const handleModelSelect = (modelId: string) => {
    console.log("[DEBUG UI] Model selected:", modelId);
    console.log("[DEBUG UI] OpenRouter enabled:", userSettings.openrouterEnabled);
    
    if (userSettings.openrouterEnabled) {
      // When using OpenRouter, update both the model selection and the OpenRouter model name
      console.log("[DEBUG UI] Updating OpenRouter model name in settings");
      const updatedSettings = {
        ...userSettings,
        openrouterModelName: modelId
      }
      onSaveSettings(updatedSettings)
    }
    
    // Call the parent component's onSelectModel function
    console.log("[DEBUG UI] Calling onSelectModel");
    onSelectModel(modelId)
  }

  // Update the OpenRouter API key handling
  const handleOpenRouterApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const apiKey = e.target.value;
    console.log("[DEBUG UI] Setting OpenRouter API key:", apiKey ? "Key provided" : "No key");
    
    const updatedSettings = {
      ...userSettings,
      openrouterApiKey: apiKey
    };
    
    onSaveSettings(updatedSettings);
  };

  return (
    <div
      className="font-inter h-screen flex bg-background"
    >
      <div className="flex flex-1 overflow-hidden">
        {/* Mobile Menu Button (only visible when sidebar is closed) */}
        {isMobile && !sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="fixed top-4 left-4 z-30 p-2 rounded-full bg-white/80 dark:bg-[#2b2b2b]/80 backdrop-blur-sm border border-gray-200/20 dark:border-gray-700/20 hover:bg-white/90 dark:hover:bg-[#2b2b2b]/90 transition-colors shadow-lg"
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
                bg-background
                                 border-r border-gray-300 dark:border-gray-600/20
              `}
            >
              {/* Sidebar Header with Title and Controls */}
                              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-300 dark:border-gray-600/20 h-[60px] bg-white dark:bg-[#2b2b2b]">
                <h1 className="text-lg font-bold text-gray-800 dark:text-[#f0f0f0]">
                  Apeiron
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
                    {conversations.length === 0 ? (
                      <div className="px-3 py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                        <div className="mb-2">No conversations yet</div>
                        <div className="text-xs">Click "New Chat" or start typing to begin</div>
                      </div>
                    ) : (
                                            conversations
                        .filter(conv => !projects.some(proj => proj.conversations.includes(conv.id))) // Only show unorganized conversations
                        .map((conversation) => (
                                              <div
                          key={conversation.id}
                          draggable
                          onDragStart={(e) => handleConversationDragStart(e, conversation.id)}
                          onDragEnd={handleConversationDragEnd}
                          className={`
                            w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200
                            hover:bg-white/20 dark:hover:bg-gray-800/40 cursor-pointer group
                            ${draggedConversationId === conversation.id ? 'opacity-50' : ''}
                            ${
                              currentConversation.id === conversation.id
                                ? "bg-white/30 dark:bg-gray-800/60 shadow-sm"
                                : "bg-transparent"
                            }
                          `}
                          onClick={() => onSelectConversation(conversation.id)}
                        >
                        <div className="flex items-center justify-between bg-white dark:bg-[#2b2b2b]">
                          <div className="flex-1 min-w-0 bg-white dark:bg-[#2b2b2b]">
                            {editingConversationId === conversation.id ? (
                              <input
                                type="text"
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                onKeyDown={handleRenameKeyPress}
                                onBlur={handleSaveRename}
                                className="w-full font-medium text-gray-800 dark:text-[#f0f0f0] bg-white dark:bg-[#2b2b2b] border border-gray-200/20 dark:border-gray-700/20 px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-sm"
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <div 
                                className="font-medium text-gray-800 dark:text-[#f0f0f0] truncate cursor-pointer bg-white dark:bg-[#2b2b2b]"
                                title="Double-click to rename conversation"
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  handleStartRename(conversation.id, conversation.title);
                                }}
                              >
                                {conversation.title}
                              </div>
                            )}
                            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 bg-white dark:bg-[#2b2b2b]">
                              <span>{new Date(conversation.timestamp).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                if (window.confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
                                  onDeleteConversation(conversation.id)
                                }
                              }}
                              className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                              title="Delete conversation"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Projects */}
                <div>
                  {/* Project header with count */}
                  <div className="flex items-center justify-between px-2 py-1 bg-white dark:bg-[#2b2b2b]">
                    <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">Projects</h2>
                    <button
                      onClick={onCreateProject}
                      className="p-1 rounded hover:bg-gray-200/20 dark:hover:bg-[#2b2b2b]/90 transition-colors"
                      aria-label="New project"
                    >
                      <Folder className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </button>
                  </div>

                  {/* Unorganized conversations drop zone */}
                  <div 
                    className={`mt-2 mb-2 p-2 rounded-lg border-2 border-dashed transition-colors dark:bg-[#2b2b2b] ${
                      dragOverProjectId === null && draggedConversationId
                        ? 'border-purple-400 bg-purple-50/10 dark:bg-purple-900/10'
                        : 'border-gray-300/30 dark:border-gray-600/30'
                    }`}
                    onDragOver={(e) => handleProjectDragOver(e, null)}
                    onDragLeave={handleProjectDragLeave}
                    onDrop={(e) => handleProjectDrop(e, null)}
                  >
                    <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                      {draggedConversationId ? 'Drop here to remove from project' : 'Unorganized conversations'}
                    </div>
                  </div>

                  <div className="space-y-1">
                    {projects.map((project) => (
                      <div key={project.id}>
                        <div 
                          className={`group relative rounded-lg transition-all duration-200 dark:bg-[#2b2b2b] ${
                            dragOverProjectId === project.id 
                              ? 'bg-purple-50/20 dark:bg-[#2b2b2b] border-2 border-purple-400 border-dashed' 
                              : 'border-2 border-transparent'
                          } ${
                            selectedProjectId === project.id
                              ? 'bg-white/30 dark:bg-[#2b2b2b] shadow-sm'
                              : 'hover:bg-white/20 dark:hover:bg-[#2b2b2b]/90'
                          }`}
                          onDragOver={(e) => handleProjectDragOver(e, project.id)}
                          onDragLeave={handleProjectDragLeave}
                          onDrop={(e) => handleProjectDrop(e, project.id)}
                        >
                          <div className="flex items-center justify-between px-3 py-2">
                            <div className="flex items-center flex-1 min-w-0">
                              <button
                                onClick={() => {
                                  onSelectProject?.(project.id)
                                  toggleProject(project.id)
                                }}
                                className="flex items-center flex-1 min-w-0 text-left"
                              >
                                {expandedProjects[project.id] ? (
                                  <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400 mr-2 flex-shrink-0" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400 mr-2 flex-shrink-0" />
                                )}
                                
                                {editingProjectId === project.id ? (
                                  <input
                                    type="text"
                                    value={editingProjectName}
                                    onChange={(e) => setEditingProjectName(e.target.value)}
                                    onKeyDown={handleProjectRenameKeyPress}
                                    onBlur={handleSaveProjectRename}
                                    className="flex-1 font-medium text-gray-800 dark:text-[#f0f0f0] bg-white dark:bg-[#2b2b2b] border border-gray-200/20 dark:border-gray-700/20 px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-sm"
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                ) : (
                                  <span 
                                    className="font-medium text-gray-800 dark:text-[#f0f0f0] truncate"
                                    title="Double-click to rename project"
                                    onDoubleClick={(e) => {
                                      e.stopPropagation();
                                      handleStartProjectRename(project.id, project.name);
                                    }}
                                  >
                                    {project.name}
                                  </span>
                                )}
                              </button>
                              
                              {/* Project count */}
                              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 flex-shrink-0">
                                {project.conversations.length}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (window.confirm('Are you sure you want to delete this project? Conversations will be moved to unorganized.')) {
                                    onDeleteProject?.(project.id)
                                  }
                                }}
                                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                title="Delete project"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {expandedProjects[project.id] && (
                            <div className="ml-6 pb-2 space-y-1 border-l-2 border-gray-200/30 dark:border-gray-600/15 pl-2">
                              {project.conversations.map((convId) => {
                                const conv = conversations.find((c) => c.id === convId)
                                if (!conv) return null

                                return (
                                  <div
                                    key={conv.id}
                                    draggable
                                    onDragStart={(e) => handleConversationDragStart(e, conv.id)}
                                    onDragEnd={handleConversationDragEnd}
                                    onClick={() => onSelectConversation(conv.id)}
                                    className={`
                                      w-full text-left px-3 py-1.5 rounded-lg text-xs transition-all duration-200
                                      dark:bg-[#2b2b2b] cursor-pointer group relative
                                      ${draggedConversationId === conv.id ? 'opacity-50' : ''}
                                      ${
                                        currentConversation.id === conv.id
                                          ? "shadow-sm"
                                          : ""
                                      }
                                    `}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex-1 min-w-0">
                                        {editingConversationId === conv.id ? (
                                          <input
                                            type="text"
                                            value={editingTitle}
                                            onChange={(e) => setEditingTitle(e.target.value)}
                                            onKeyDown={handleRenameKeyPress}
                                            onBlur={handleSaveRename}
                                            className="w-full font-medium text-gray-800 dark:text-[#f0f0f0] bg-white dark:bg-[#2b2b2b] border border-gray-200/20 dark:border-gray-700/20 px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-sm"
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
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Profile and Settings Section */}
              <div className="px-4 py-3 h-[72px] flex items-center gap-3">
                {isAuthenticated ? (
                  <div ref={profileDropdownRef} className="relative flex-1">
                    <button
                      onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                      className="w-full h-12 flex items-center gap-3 px-3 rounded-xl bg-white/20 dark:bg-[#2b2b2b] hover:bg-white/30 dark:hover:bg-[#2b2b2b]/90 transition-colors text-gray-800 dark:text-gray-200"
                    >
                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white font-medium text-sm">
                        {user?.email?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      
                      {/* User Info */}
                      <div className="flex-1 text-left min-w-0">
                        <div className="text-sm font-medium truncate">
                          {user?.user_metadata?.full_name || user?.user_metadata?.first_name || user?.email?.split('@')[0] || 'User'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          Online
                        </div>
                      </div>
                      
                      {/* Dropdown Arrow */}
                      <ChevronDown className={`w-4 h-4 transition-transform ${profileDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Menu */}
                    <AnimatePresence>
                      {profileDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                          className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-[#2b2b2b] rounded-xl border border-gray-200/20 dark:border-gray-600/20 shadow-lg backdrop-blur-sm overflow-hidden"
                        >
                          <button
                            onClick={() => {
                              setSettingsOpen(true)
                              setProfileDropdownOpen(false)
                            }}
                            className="w-full px-4 py-3 text-left hover:bg-gray-100/50 dark:hover:bg-gray-700/50 transition-colors flex items-center gap-3 text-gray-800 dark:text-gray-200"
                          >
                            <Settings className="w-4 h-4" />
                            <span>Settings</span>
                          </button>
                          
                          <div className="border-t border-gray-200/20 dark:border-gray-600/20" />
                          
                          <button
                            onClick={() => {
                              onLogout?.()
                              setProfileDropdownOpen(false)
                            }}
                            className="w-full px-4 py-3 text-left hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-3 text-red-600 dark:text-red-400"
                          >
                            <LogOut className="w-4 h-4" />
                            <span>Sign Out</span>
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={onLogin}
                      className="w-12 h-12 rounded-xl bg-gradient-to-r from-gray-400 to-gray-500 hover:from-gray-600 hover:to-gray-700 flex items-center justify-center text-white font-medium shadow-lg transition-all duration-200"
                      title="Sign in to save conversations"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </button>

                    {/* Settings Button for Non-Authenticated Users */}
                    <button
                      onClick={() => setSettingsOpen(true)}
                      className="flex-1 h-12 flex items-center justify-center gap-2 rounded-xl bg-white/20 dark:bg-[#2b2b2b] hover:bg-white/30 dark:hover:bg-[#2b2b2b]/90 transition-colors text-gray-800 dark:text-gray-200"
                      aria-label="Open settings"
                    >
                      <Settings className="w-4 h-4" />
                      <span>Settings</span>
                    </button>
                  </>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Desktop Sidebar Toggle (only visible when sidebar is closed on desktop) */}
              {!isMobile && !sidebarOpen && (
                <button
                  onClick={() => setSidebarOpen(true)}
            className="fixed top-4 left-4 z-30 p-2 rounded-full bg-white/80 dark:bg-[#2b2b2b]/80 backdrop-blur-sm border border-gray-200/20 dark:border-gray-700/20 hover:bg-white/90 dark:hover:bg-[#2b2b2b]/90 transition-colors shadow-lg"
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
          <div 
            className="flex-1 overflow-y-auto p-4 space-y-6" 
            ref={messagesContainerRef}
            onScroll={handleScroll}
          >
            {currentConversation.messages.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center max-w-md mx-auto">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-900 dark:bg-white flex items-center justify-center">
                    <svg className="w-8 h-8 text-white dark:text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
                    Start a conversation
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Type your message below to begin chatting with AI
                  </p>
                  <div className="text-sm text-gray-500 dark:text-gray-500">
                    💡 Tip: You can double-click conversation names to rename them
                  </div>
                </div>
              </div>
            ) : (
              currentConversation.messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`${message.role === "user" ? "flex justify-end" : "flex flex-col items-center"} w-full`}
              >
                <div
                  className={`
                    ${message.role === "user" 
                      ? "max-w-[85%] md:max-w-[70%] rounded-2xl p-4 bg-white/20 dark:bg-gray-800/40 text-gray-800 dark:text-gray-200 border border-gray-200/20 dark:border-gray-700/20" 
                      : "w-full max-w-4xl py-6 px-4"
                    }
                  `}
                >
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
                  {message.content ? renderMessageContent(message) : null}

                  {/* Web Search Results Sources */}
                  {message.searchResults && message.searchResults.length > 0 && (
                    <div className={`mt-4 pt-4 border-t border-gray-200/30 dark:border-gray-700/30 ${message.role === "assistant" ? "w-full max-w-4xl mx-auto" : ""}`}>
                      <div className={`flex items-center gap-2 mb-2 ${message.role === "assistant" ? "justify-center" : ""}`}>
                        <Globe className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Web Search Results</span>
                      </div>
                      <div className={`space-y-3 ${message.role === "assistant" ? "flex flex-col items-center" : ""}`}>
                        {message.searchResults?.map((result, index) => (
                          <div 
                            key={`source-${index + 1}`}
                            id={`source-${index + 1}`}
                            className={`
                              p-3 rounded-lg border border-gray-200/30 dark:border-gray-700/30
                              ${message.role === "assistant" 
                                ? "bg-white/10 dark:bg-gray-800/30 w-full max-w-3xl" 
                                : "bg-white/10 dark:bg-gray-800/30"}
                            `}
                          >
                            <div className="flex items-start justify-between">
                              <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full mr-2">
                                {index + 1}
                              </span>
                              <div className="flex-1">
                                <a 
                                  href={result.url} 
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium text-blue-600 dark:text-blue-400 hover:underline line-clamp-2"
                                >
                                  {result.title || getHostnameFromUrl(result.url)}
                                </a>
                                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center mt-1">
                                  <Globe className="w-3 h-3 mr-1" />
                                  <span>{getHostnameFromUrl(result.url)}</span>
                                </div>
                              </div>
                              <a 
                                href={result.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                <ExternalLink className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                              </a>
                            </div>
                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                              {result.snippet}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Retry button for error messages */}
                  {message.isError && message.retryData && (
                    <div className="mt-3 pt-3">
                      <button
                        onClick={() => onRetryMessage(message.id, currentModel)}
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
                    ${message.role === "user" ? "text-gray-600 dark:text-gray-300" : "text-gray-500 dark:text-gray-400"}
                  `}
                  >
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>

                  {/* Model icon and name for assistant messages - moved to end */}
                  {message.role === "assistant" && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <ModelLogo 
                        provider={(() => {
                          // First try to use the message provider
                          if (message.provider) {
                            return message.provider as "openai" | "claude" | "gemini" | "deepseek" | "grok" | "openrouter" | "veo2" | "mistral" | "runway";
                          }
                          // Fallback: determine provider from model ID
                          if (message.model) {
                            if (message.model.includes('gpt') || message.model.includes('o3')) return 'openai';
                            if (message.model.includes('claude')) return 'claude';
                            if (message.model.includes('gemini')) return 'gemini';
                            if (message.model.includes('veo2')) return 'veo2';
                            if (message.model.includes('deepseek')) return 'deepseek';
                            if (message.model.includes('grok')) return 'grok';
                            if (message.model.includes('mistral') || message.model.includes('codestral')) return 'mistral';
                            if (message.model.includes('runway')) return 'runway';
                          }
                          return 'openai'; // final fallback
                        })()} 
                        modelId={message.model || 'unknown'}
                        size="sm"
                      />
                      <div className="relative group">
                        <div className="flex items-center gap-2 cursor-pointer">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {(() => {
                              // First try to use the exact model name from the message
                              if (message.model) {
                                // Try to find in available models first
                                const model = availableModels.find(m => m.id === message.model);
                                if (model) return model.name;
                                
                                // If not found in available models, try the comprehensive library
                                const libraryModel = allModelsLibrary.find(m => m.id === message.model);
                                if (libraryModel) return libraryModel.name;
                                
                                // If still not found, return the model ID as is
                                return message.model;
                              }
                              
                              // Fallback to provider name if no model specified
                              if (message.provider) {
                                const providerNames: Record<Model['provider'], string> = {
                                  openai: "OpenAI",
                                  claude: "Claude",
                                  gemini: "Gemini",
                                  deepseek: "DeepSeek",
                                  grok: "Grok",
                                  openrouter: "OpenRouter",
                                  veo2: "VEO 2",
                                  mistral: "Mistral",
                                  runway: "RunwayML"
                                };
                                return providerNames[message.provider as Model['provider']] || message.provider;
                              }
                              
                              return 'AI';
                            })()}
                          </span>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              // First update the model selection if needed
                              if (message.model !== currentModel) {
                                await onSelectModel(currentModel);
                                // Wait for model selection to complete
                                await new Promise(resolve => setTimeout(resolve, 50));
                              }
                              onRetryMessage(message.id, currentModel);
                            }}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                            title="Retry original message with this model"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 dark:text-gray-400">
                              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                              <path d="M21 3v5h-5" />
                            </svg>
                          </button>
                        </div>
                        
                        {/* Model Selection Dropdown */}
                        <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block">
                          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[200px]">
                            <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                              Retry original message with:
                            </div>
                            {availableModels.map((model) => (
                              <button
                                key={model.id}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  
                                  // First update the model selection
                                  onSelectModel(model.id);
                                  
                                  // Then retry the message with the explicitly selected model
                                  // Pass the model.id directly instead of relying on currentModel state
                                  onRetryMessage(message.id, model.id);
                                }}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                              >
                                <ModelLogo provider={model.provider} modelId={model.id} size="sm" />
                                <span className="text-gray-700 dark:text-gray-300">{model.name}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
              ))
            )}

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
                      modelId={currentModel}
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
            className={`px-4 py-3 backdrop-blur-lg bg-white/10 dark:bg-gray-900/30 relative ${
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
              <div className="flex flex-wrap gap-2 px-4 py-2 border-t border-gray-200/20 dark:border-gray-700/20">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center gap-2 px-2 py-1 rounded-lg bg-white/10 dark:bg-gray-800/40 border border-gray-200/20 dark:border-gray-700/20"
                  >
                    {attachment.type.startsWith('image/') ? (
                      <div className="relative group">
                        {attachment.id.startsWith('temp-') ? (
                          <div className="w-8 h-8 flex items-center justify-center rounded bg-gray-100 dark:bg-gray-800">
                            <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                          </div>
                        ) : (
                          <>
                            <img
                              src={attachment.previewUrl || attachment.url}
                              alt={attachment.name}
                              className="w-8 h-8 object-cover rounded"
                              onError={(e) => {
                                console.error('Image preview failed to load:', e);
                                e.currentTarget.src = '/placeholder.jpg';
                              }}
                            />
                            {/* Image preview tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-gray-800/90 dark:bg-gray-900/90 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-xl">
                              <img
                                src={attachment.previewUrl || attachment.url}
                                alt={attachment.name}
                                className="max-w-[200px] max-h-[200px] rounded object-contain"
                                onError={(e) => {
                                  console.error('Large preview failed to load:', e);
                                  e.currentTarget.src = '/placeholder.jpg';
                                }}
                              />
                              <div className="text-xs text-gray-300 mt-2 text-center">
                                {attachment.name}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    )}
                    <span className="truncate max-w-[100px] text-sm">{attachment.name}</span>
                    <button
                      onClick={() => removeAttachment(attachment.id)}
                      className="text-gray-500 hover:text-red-500 transition-colors"
                      title="Remove attachment"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Centralized Chat Input */}
            <div className="flex flex-col items-center w-full">
              <div className="w-full max-w-3xl">
                {/* Main Chat Input Area */}
                <div className="bg-white/20 dark:bg-gray-800/40 rounded-xl border border-gray-200/20 dark:border-gray-700/20 overflow-hidden focus-within:ring-2 focus-within:ring-purple-500/50">
                  <div className="relative">
                    <textarea
                      ref={chatInputRef}
                      value={inputValue}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyPress}
                      placeholder="Ask anything..."
                      className="w-full px-4 py-3 bg-transparent text-gray-800 dark:text-gray-200 resize-none focus:outline-none pr-[100px]"
                      rows={1}
                      style={{
                        height: "auto",
                        minHeight: "48px",
                      }}
                      aria-label="Message input"
                    />
                    
                    {/* Send Button (inside textarea) */}
                    <button
                      onClick={handleSendMessage}
                      disabled={!inputValue.trim() && attachments.length === 0}
                      className={`
                        absolute right-2 bottom-2 h-[32px] w-[32px] rounded-lg flex-shrink-0 transition-all duration-200 
                        flex items-center justify-center border border-gray-200/20 dark:border-gray-600/20
                        ${
                          inputValue.trim() || attachments.length > 0
                            ? "bg-white/20 dark:bg-gray-800/40 hover:bg-white/30 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-300"
                            : "bg-gray-200/50 dark:bg-gray-700/50 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                        }
                      `}
                      aria-label="Send message"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Bottom toolbar inside chatbar */}
                  <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200/20 dark:border-gray-700/20 bg-white/5 dark:bg-gray-800/20">
                    {/* Left side buttons */}
                    <div className="flex items-center gap-2">
                      {/* Model Selector */}
                      <div className="relative">
                        <select
                          value={currentModel}
                          onChange={(e) => handleModelSelect(e.target.value)}
                          className="h-[36px] px-2 pr-7 rounded-md bg-white/10 dark:bg-[#2b2b2b]/80 backdrop-blur-lg border border-gray-200/20 dark:border-gray-700/20 text-gray-800 dark:text-gray-200 text-xs appearance-none focus:outline-none focus:ring-1 focus:ring-purple-500/50 [&>option]:bg-white dark:[&>option]:bg-[#2b2b2b] dark:[&>option]:text-gray-200"
                          aria-label="Select AI model"
                        >
                          {availableModels.length === 0 ? (
                            <option value="" disabled>
                              {userSettings.openrouterEnabled 
                                ? "No models selected. Go to Settings > Models to select models." 
                                : "No models available"}
                            </option>
                          ) : (
                            availableModels.map((model) => (
                              <option key={model.id} value={model.id}>
                                {model.name}
                              </option>
                            ))
                          )}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400 pointer-events-none" />
                      </div>

                      {/* Web Search Toggle Button */}
                      {isWebSearchCompatible() && (
                        <button
                          onClick={toggleWebSearch}
                          className={`h-[36px] w-[36px] rounded-md border border-gray-200/20 dark:border-gray-700/20 transition-all duration-200 flex items-center justify-center relative ${
                            webSearchEnabled
                              ? enhancedWebSearch
                                ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white" // Enhanced mode
                                : "bg-gradient-to-r from-blue-500 to-cyan-500 text-white"   // Basic mode
                              : "bg-white/10 dark:bg-gray-800/40 hover:bg-white/30 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400"
                          }`}
                          title={webSearchEnabled 
                            ? (enhancedWebSearch
                              ? "Enhanced web search with content analysis" + (locationPermission === "granted" ? ` (Location: ${userLocation})` : "")
                              : (locationPermission === "granted" 
                                ? `Basic web search (Location: ${userLocation})` 
                                : "Basic web search (no location data)"))
                            : "Enable web search"}
                          aria-label={webSearchEnabled 
                            ? (enhancedWebSearch ? "Switch to basic web search" : "Disable web search") 
                            : "Enable web search"}
                        >
                          {webSearchEnabled ? (
                            enhancedWebSearch ? (
                              <div className="flex items-center justify-center">
                                <Globe className="w-4 h-4" />
                                <span className="absolute bottom-0 right-0 text-[9px] font-bold">+</span>
                              </div>
                            ) : (
                              <Globe className="w-4 h-4" />
                            )
                          ) : (
                            <Search className="w-4 h-4" />
                          )}
                          {webSearchEnabled && locationPermission === "granted" && (
                            <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full"></div>
                          )}
                        </button>
                      )}

                      {/* Code Generation Toggle Button */}
                      {isCodeGenerationCompatible() && (
                        <button
                          onClick={handleCodeGenerationToggle}
                          className={`h-[36px] w-[36px] rounded-md border border-gray-200/20 dark:border-gray-700/20 transition-all duration-200 flex items-center justify-center ${
                            codeGenerationEnabled
                              ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
                              : "bg-white/10 dark:bg-gray-800/40 hover:bg-white/30 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400"
                          }`}
                          title={codeGenerationEnabled ? "Code generation enabled" : "Enable code generation"}
                          aria-label={codeGenerationEnabled ? "Disable code generation" : "Enable code generation"}
                        >
                          <Code className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    
                    {/* Right side buttons */}
                    <div className="flex items-center gap-2">
                      {/* File Upload Button */}
                      <label className="h-[36px] w-[36px] rounded-md bg-white/10 dark:bg-[#2b2b2b]/80 hover:bg-white/30 dark:hover:bg-[#2b2b2b]/90 border border-gray-200/20 dark:border-gray-700/20 transition-colors cursor-pointer flex items-center justify-center relative group"
                        title="Upload files (Images & PDFs)">
                        <input
                          type="file"
                          multiple
                          accept=".jpg,.jpeg,.png,.gif,.webp,application/pdf"
                          onChange={handleFileInputChange}
                          className="hidden"
                          aria-label="Upload files"
                        />
                        {isUploading ? (
                          <Loader2 className="w-4 h-4 text-gray-600 dark:text-gray-400 animate-spin" />
                        ) : (
                          <>
                            <Paperclip className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                              Upload Images & PDFs
                            </div>
                          </>
                        )}
                      </label>
                      
                      {/* Voice Input Button */}
                      <button
                        onClick={isListening ? stopListening : startListening}
                        className={`h-[36px] w-[36px] rounded-md flex-shrink-0 flex items-center justify-center transition-all duration-200 relative ${
                          isListening
                            ? "bg-gradient-to-r from-red-500 to-red-600 text-white"
                            : "bg-white/10 dark:bg-gray-800/40 hover:bg-white/30 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400 border border-gray-200/20 dark:border-gray-700/20"
                        }`}
                        aria-label={isListening ? "Stop voice input" : "Start voice input"}
                        title={isListening ? "🎤 Listening... Click to stop" : "🎤 Click to start voice input"}
                      >
                        <Mic className={`w-4 h-4 ${isListening ? 'animate-pulse' : ''}`} />
                        {isListening && (
                          <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-ping"></div>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
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
                  <button
                    onClick={() => setSettingsTab("themes")}
                    className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                      settingsTab === "themes"
                        ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                    }`}
                  >
                    Themes
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
                        <div className="space-y-3 pt-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              OpenRouter API Key
                            </label>
                            <input
                              type="password"
                              value={userSettings.openrouterApiKey}
                              onChange={(e) => {
                                console.log("[DEBUG UI] Setting OpenRouter API key:", e.target.value ? "Key provided" : "No key");
                                const updatedSettings = { 
                                  ...userSettings, 
                                  openrouterApiKey: e.target.value 
                                };
                                onSaveSettings(updatedSettings);
                                
                                // If OpenRouter is enabled and we have a key, make sure a model is selected
                                if (userSettings.openrouterEnabled && e.target.value && !userSettings.openrouterModelName) {
                                  const defaultModel = "anthropic/claude-3.7-sonnet";
                                  console.log("[DEBUG UI] Auto-selecting default model after API key change:", defaultModel);
                                  setTimeout(() => {
                                    onSelectModel(defaultModel);
                                    onSaveSettings({
                                      ...updatedSettings,
                                      openrouterModelName: defaultModel
                                    });
                                  }, 100);
                                }
                              }}
                              className="w-full p-2 rounded-lg bg-white/50 dark:bg-gray-900/50 border border-gray-200/50 dark:border-gray-700/50 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                              placeholder="sk-or-..."
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              Available Models
                            </label>
                            <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                              {modelLibrary.openrouter.models.map((model) => (
                                model.id !== 'custom' && (
                                  <label
                                    key={model.id}
                                    className="flex items-start gap-3 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700/50 cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={openrouterSelectedModels.includes(model.id)}
                                      onChange={() => handleOpenrouterModelToggle(model.id)}
                                      className="mt-1 w-4 h-4 text-purple-500 border-gray-300 dark:border-gray-600 rounded focus:ring-purple-500"
                                    />
                                    <div className="flex-1">
                                      <div className="font-medium text-gray-900 dark:text-gray-100">{model.name}</div>
                                      <div className="text-sm text-gray-500 dark:text-gray-400">{model.description}</div>
                                    </div>
                                  </label>
                                )
                              ))}
                            </div>
                          </div>

                          <div className="pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                              Add Custom Model
                            </label>
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={newCustomModel.id}
                                onChange={(e) => setNewCustomModel(prev => ({ ...prev, id: e.target.value }))}
                                placeholder="Model ID (e.g., anthropic/claude-3-opus)"
                                className="w-full p-2 rounded-lg bg-white/50 dark:bg-gray-900/50 border border-gray-200/50 dark:border-gray-700/50 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                              />
                              <input
                                type="text"
                                value={newCustomModel.name}
                                onChange={(e) => setNewCustomModel(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Display Name"
                                className="w-full p-2 rounded-lg bg-white/50 dark:bg-gray-900/50 border border-gray-200/50 dark:border-gray-700/50 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                              />
                              <button
                                onClick={handleAddCustomModel}
                                disabled={!newCustomModel.id || !newCustomModel.name}
                                className="w-full px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Add Custom Model
                              </button>
                            </div>

                            {openrouterCustomModels.length > 0 && (
                              <div className="mt-3">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  Your Custom Models
                                </label>
                                <div className="space-y-2">
                                  {openrouterCustomModels.map((model) => (
                                    <div
                                      key={model.id}
                                      className="flex items-center justify-between p-2 rounded-lg bg-white/50 dark:bg-gray-900/50 border border-gray-200/50 dark:border-gray-700/50"
                                    >
                                      <div>
                                        <div className="font-medium text-gray-900 dark:text-gray-100">{model.name}</div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400">{model.id}</div>
                                      </div>
                                      <button
                                        onClick={() => {
                                          setOpenrouterCustomModels(prev => prev.filter(m => m.id !== model.id))
                                          setOpenrouterSelectedModels(prev => prev.filter(id => id !== model.id))
                                        }}
                                        className="p-1 text-red-500 hover:text-red-600 transition-colors"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
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
                                <option value="mistral">Mistral AI</option>
                                <option value="runway">RunwayML</option>
                              </select>
                            </div>

                            {newModelProvider === "runway" && (
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

                {settingsTab === "themes" && (
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Choose Your Theme</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Select a theme to customize the appearance of your chat interface.
                      </p>
                      
                      <div className="grid gap-4">
                        {themeLibrary.map((themeOption) => (
                          <div
                            key={themeOption.id}
                            onClick={() => handleThemeSelect(themeOption.id)}
                            className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
                              currentTheme === themeOption.id
                                ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-400"
                                : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              {/* Theme Preview */}
                              <div
                                className="w-16 h-16 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
                                style={{ background: themeOption.preview }}
                              />
                              
                              {/* Theme Info */}
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h5 className="font-medium text-gray-900 dark:text-gray-100">
                                    {themeOption.name}
                                  </h5>
                                  {currentTheme === themeOption.id && (
                                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                  {themeOption.description}
                                </p>
                              </div>
                              
                              {/* Selection Indicator */}
                              <div className={`w-5 h-5 rounded-full border-2 transition-colors ${
                                currentTheme === themeOption.id
                                  ? "border-purple-500 bg-purple-500"
                                  : "border-gray-300 dark:border-gray-600"
                              }`}>
                                {currentTheme === themeOption.id && (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <div className="w-2 h-2 bg-white rounded-full"></div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Theme Note */}
                      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                        <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                          💡 Light & Dark Modes
                        </h5>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Each theme supports both light and dark modes. Use the theme toggle button in the header to switch between light and dark modes for your selected theme.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-5 flex justify-end gap-3">
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
