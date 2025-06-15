"use client"

import { useState, useEffect, useRef } from "react"
import MainUI from "@/main-ui"
import { AuthModal } from "@/components/AuthModal"

import { useAuth } from "@/hooks/useAuth"
import {
  getProjects,
  getConversations,
  getMessages,
  getConversationWithMessages,
  createProject,
  createConversation,
  createMessage,
  updateConversation,
  updateProject,
  deleteProject,
  deleteConversation,
  deleteConversationWithMessages,
  migrateLocalDataToSupabase
} from "@/lib/database"
import { Project as DBProject, Conversation as DBConversation, Message as DBMessage } from "@/lib/database.types"
import { Loader2 } from "lucide-react"

// Types
type UIMessage = {
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
}

type Model = {
  id: string
  name: string
  icon: string
  apiKey?: string
  provider: "openai" | "claude" | "gemini" | "deepseek" | "grok" | "openrouter" | "veo2" | "mistral"
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
  enabledSubModels: { [provider: string]: string[] } // Track which sub-models are enabled per provider
  selectedTheme?: string // Currently selected theme
}

type UIConversation = DBConversation & {
  messages: UIMessage[]
}

type UIProject = {
  id: string
  name: string
  description?: string | null
  user_id: string
  created_at: string
  updated_at: string
  color?: string | null
}

export default function Home() {
  // Authentication state
  const { 
    user, 
    userProfile, 
    loading: authLoading, 
    signOut, 
    isAuthenticated 
  } = useAuth()

  const [isClient, setIsClient] = useState(false)
  const [conversations, setConversations] = useState<UIConversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState("")
  const [currentModel, setCurrentModel] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [userSettings, setUserSettings] = useState<UserSettings>({
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
    enabledSubModels: {},
    selectedTheme: "basic"
  })
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [projects, setProjects] = useState<UIProject[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({})
  const [dataLoading, setDataLoading] = useState(false)
  const [migrationCompleted, setMigrationCompleted] = useState(false)
  const loadingRef = useRef(false)

  // Client-side initialization
  useEffect(() => {
    const cleanUpUrlFragments = () => {
      if (typeof window !== 'undefined') {
        const currentUrl = window.location.href
        if (currentUrl.includes('#access_token=') || currentUrl.includes('#error=')) {
          window.history.replaceState({}, document.title, window.location.pathname + window.location.search)
        }
      }
    }

    const loadSettings = (): UserSettings => {
      // No need to check for window here, useEffect only runs on client
      try {
        const saved = localStorage.getItem("t3-chat-user-settings")
        if (saved) {
          const parsed = JSON.parse(saved)
          return {
            temperature: parsed.temperature || 0.7,
            models: parsed.models || [],
            openrouterEnabled: parsed.openrouterEnabled || false,
            openrouterApiKey: parsed.openrouterApiKey || "",
            openrouterModelName: parsed.openrouterModelName || "",
            openaiApiKey: parsed.openaiApiKey || "",
            claudeApiKey: parsed.claudeApiKey || "",
            geminiApiKey: parsed.geminiApiKey || "",
            deepseekApiKey: parsed.deepseekApiKey || "",
            grokApiKey: parsed.grokApiKey || "",
            veo2ApiKey: parsed.veo2ApiKey || "",
            mistralApiKey: parsed.mistralApiKey || "",
            enabledSubModels: parsed.enabledSubModels || {},
            selectedTheme: parsed.selectedTheme || "basic"
          }
        }
      } catch (error) {
        console.error("Failed to load settings:", error)
      }

      return {
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
        enabledSubModels: {},
        selectedTheme: "basic"
      }
    }

    const loadLocalConversations = () => {
      try {
        const saved = localStorage.getItem("t3-chat-conversations")
        if (saved) {
          const parsed = JSON.parse(saved)
          const mappedConversations = parsed.map((conv: any) => ({
            id: conv.id,
            title: conv.title,
            timestamp: new Date(conv.timestamp),
            model: conv.model,
            messages: conv.messages.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            })),
            user_id: "local",
            project_id: conv.project_id || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }))
          setConversations(mappedConversations)
          if (mappedConversations.length > 0 && !currentConversationId) {
            setCurrentConversationId(mappedConversations[0].id)
          }
        } else {
          // Don't create default conversations - start with empty state
          setConversations([])
        }
      } catch (error) {
        console.error("Failed to load local conversations:", error)
        // Don't create fallback conversations - start with empty state
        setConversations([])
      }
    }

    const loadLocalProjects = () => {
      try {
        const saved = localStorage.getItem("t3-chat-projects")
        if (saved) {
          const parsed = JSON.parse(saved)
          const mappedProjects = parsed.map((proj: any) => ({
            id: proj.id,
            name: proj.name,
            description: proj.description || null,
            user_id: "local",
            created_at: proj.created_at || new Date().toISOString(),
            updated_at: proj.updated_at || new Date().toISOString(),
            color: proj.color || null
          }))
          setProjects(mappedProjects)
        } else {
          setProjects([])
        }
      } catch (error) {
        console.error("Failed to load local projects:", error)
        setProjects([])
      }
    }

    // Clean up URL fragments first
    cleanUpUrlFragments()
    
    const settings = loadSettings()
    setUserSettings(settings)
    
    // Set default model to first available model based on API keys
    const getFirstAvailableModel = (settings: UserSettings): string => {
      // Get available models and return the first one
      const availableModels = getAvailableModelsForSettings(settings)
      if (availableModels.length > 0) {
        return availableModels[0].id
      }
      // If no API keys are configured, return a default that will show setup message
      return "no-models-configured"
    }


    
    const defaultModel = getFirstAvailableModel(settings)
    setCurrentModel(defaultModel)
    
    // Apply saved theme
    if (settings.selectedTheme) {
      const themeClasses = ['theme-basic']
      const lightDarkClasses = ['light', 'dark']
      document.documentElement.classList.remove(...themeClasses, ...lightDarkClasses)
      
      // Always add the theme class
      document.documentElement.classList.add(`theme-${settings.selectedTheme}`)
      
      // Apply dark mode by default
      document.documentElement.classList.add('dark')
    } else {
      // Fallback - ensure we have basic classes
      document.documentElement.classList.add('theme-basic', 'dark')
    }
    
    loadLocalConversations() // Load local conversations for non-authenticated users
    loadLocalProjects() // Load local projects for non-authenticated users
    setIsClient(true) // Set client to true after settings are loaded
  }, [])

  // Load data when user is authenticated (optional)
  useEffect(() => {
    if (isAuthenticated && user && !authLoading && !dataLoading && !loadingRef.current) {
      loadUserData()
    }
  }, [isAuthenticated, user, authLoading])

  const loadUserData = async () => {
    if (!user || dataLoading || loadingRef.current) return
    
    loadingRef.current = true
    setDataLoading(true)

    try {
      // Check if migration is needed BEFORE loading data
      const migrated = localStorage.getItem('t3-chat-migrated')
      const needsMigration = !migrated && !migrationCompleted
      
      if (needsMigration) {
        console.log('Starting local data migration...')
        await migrateLocalDataToSupabase(user.id)
        setMigrationCompleted(true)
        localStorage.setItem('t3-chat-migrated', 'true')
        console.log('Migration completed')
        // Continue with normal data loading after migration
      }

      // Load projects
      const userProjects = await getProjects(user.id)
      const uiProjects: UIProject[] = userProjects.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        user_id: p.user_id,
        created_at: p.created_at,
        updated_at: p.updated_at,
        color: p.color
      }))
      setProjects(uiProjects)

      // Load conversations
      const userConversations = await getConversations(user.id)
      
      // Load messages for each conversation in parallel
      const conversationsWithMessages = await Promise.all(
        userConversations.map(async (conv) => {
          try {
            const messages = await getMessages(conv.id)
            return {
              ...conv,
              messages: messages.map(msg => ({
                id: msg.id,
                content: msg.content,
                role: msg.role as "user" | "assistant",
                timestamp: new Date(msg.timestamp),
                model: msg.model || undefined,
                provider: msg.provider || undefined,
                attachments: msg.attachments as any[] || undefined,
                searchResults: msg.search_results as any[] || undefined
              }))
            }
          } catch (error) {
            console.error(`Error loading messages for conversation ${conv.id}:`, error)
            return {
              ...conv,
              messages: []
            }
          }
        })
      )

      setConversations(conversationsWithMessages)

      // Set current conversation if none selected
      if (conversationsWithMessages.length > 0 && !currentConversationId) {
        setCurrentConversationId(conversationsWithMessages[0].id)
      }

    } catch (error) {
      console.error('Error loading user data:', error)
    } finally {
      setDataLoading(false)
      loadingRef.current = false
    }
  }

  const saveConversationsLocally = (updatedConversations: UIConversation[]) => {
    if (!isAuthenticated) {
      // Save to localStorage for non-authenticated users
      try {
        const localConversations = updatedConversations.map(conv => ({
          id: conv.id,
          title: conv.title,
          timestamp: conv.updated_at,
          model: conv.model,
          messages: conv.messages,
          project_id: conv.project_id
        }))
        localStorage.setItem("t3-chat-conversations", JSON.stringify(localConversations))
      } catch (error) {
        console.error("Failed to save conversations locally:", error)
      }
    }
  }

  const saveProjectsLocally = (updatedProjects: UIProject[]) => {
    if (!isAuthenticated) {
      // Save to localStorage for non-authenticated users
      try {
        const localProjects = updatedProjects.map(proj => ({
          id: proj.id,
          name: proj.name,
          description: proj.description,
          created_at: proj.created_at,
          updated_at: proj.updated_at,
          color: proj.color
        }))
        localStorage.setItem("t3-chat-projects", JSON.stringify(localProjects))
      } catch (error) {
        console.error("Failed to save projects locally:", error)
      }
    }
  }

  const handleCreateProject = async (name: string = "New Project", description?: string) => {
    const newProject: UIProject = {
      id: Date.now().toString(),
      name,
      description: description || null,
      user_id: user?.id || "local",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      color: null
    }

    if (isAuthenticated && user) {
      try {
        const dbProject = await createProject({
          name,
          description: description || '',
          user_id: user.id
        })
        newProject.id = dbProject.id
        newProject.created_at = dbProject.created_at
        newProject.updated_at = dbProject.updated_at
        newProject.description = dbProject.description
        newProject.color = dbProject.color
      } catch (error) {
        console.error('Error creating project in database:', error)
      }
    }

    const updatedProjects = [...projects, newProject]
    setProjects(updatedProjects)
    saveProjectsLocally(updatedProjects)
    return newProject.id
  }

  const handleUpdateProject = async (id: string, updates: Partial<UIProject>) => {
    const updatedProjects = projects.map(p => 
      p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p
    )
    setProjects(updatedProjects)
    saveProjectsLocally(updatedProjects)

    if (isAuthenticated) {
      try {
        await updateProject(id, updates)
      } catch (error) {
        console.error('Error updating project:', error)
      }
    }
  }

  const handleDeleteProject = async (id: string) => {
    const updatedProjects = projects.filter(p => p.id !== id)
    setProjects(updatedProjects)
    saveProjectsLocally(updatedProjects)
    
    // Update conversations that were in this project
    const updatedConversations = conversations.map(conv => 
      conv.project_id === id 
        ? { ...conv, project_id: null }
        : conv
    )
    setConversations(updatedConversations)
    saveConversationsLocally(updatedConversations)
    
    if (selectedProjectId === id) {
      setSelectedProjectId(null)
    }

    if (isAuthenticated) {
      try {
        await deleteProject(id)
      } catch (error) {
        console.error('Error deleting project:', error)
      }
    }
  }

  const handleSelectProject = (projectId: string | null) => {
    setSelectedProjectId(projectId)
    
    // Find the most recent conversation in this project
    const projectConversations = projectId 
      ? conversations.filter(conv => conv.project_id === projectId)
      : conversations
    
    if (projectConversations.length > 0) {
      // Sort by updated_at to get the most recent conversation
      const sortedConversations = projectConversations.sort((a, b) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      )
      const selectedConversation = sortedConversations[0]
      
      // Only switch if it's different from current conversation
      if (currentConversationId !== selectedConversation.id) {
        setCurrentConversationId(selectedConversation.id)
      }
    } else {
      // No conversations in this project, clear current conversation
      setCurrentConversationId("")
    }
  }

  const handleMoveConversation = async (conversationId: string, projectId: string | null) => {
    const updatedConversations = conversations.map(conv => 
      conv.id === conversationId 
        ? { ...conv, project_id: projectId, updated_at: new Date().toISOString() }
        : conv
    )
    setConversations(updatedConversations)
    saveConversationsLocally(updatedConversations)

    if (isAuthenticated) {
      try {
        await updateConversation(conversationId, { project_id: projectId })
      } catch (error) {
        console.error('Error moving conversation:', error)
      }
    }
  }

  const handleCreateConversation = async () => {
    // Only assign to project if it's both selected AND expanded
    const shouldAssignToProject = selectedProjectId && expandedProjects[selectedProjectId]
    
    const newConversation: UIConversation = {
      id: Date.now().toString(),
      title: "New Conversation",
      model: currentModel,
      messages: [],
      user_id: user?.id || "local",
      project_id: shouldAssignToProject ? selectedProjectId : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    if (isAuthenticated && user) {
      try {
        const dbConversation = await createConversation({
          title: newConversation.title,
          model: newConversation.model,
          user_id: user.id,
          project_id: shouldAssignToProject ? selectedProjectId : null
        })
        newConversation.id = dbConversation.id
        newConversation.created_at = dbConversation.created_at
        newConversation.updated_at = dbConversation.updated_at
      } catch (error) {
        console.error('Error creating conversation in database:', error)
      }
    }

    const updatedConversations = [...conversations, newConversation]
    setConversations(updatedConversations)
    setCurrentConversationId(newConversation.id)
    saveConversationsLocally(updatedConversations)
  }

  const handleSelectConversation = async (id: string) => {
    setCurrentConversationId(id)
    
    // Check if conversation already has messages loaded
    const conversation = conversations.find(conv => conv.id === id)
    if (!conversation) return
    
    // If messages are already loaded, no need to fetch again
    if (conversation.messages.length > 0) return
    
    // Only fetch messages if authenticated and conversation has no messages
    if (isAuthenticated && user) {
      try {
        const messages = await getMessages(id)
        const loadedMessages = messages.map(msg => ({
          id: msg.id,
          content: msg.content,
          role: msg.role as "user" | "assistant",
          timestamp: new Date(msg.timestamp),
          model: msg.model || undefined,
          provider: msg.provider || undefined,
          attachments: msg.attachments as any[] || undefined,
          searchResults: msg.search_results as any[] || undefined
        }))
        
        // Update the conversation with fresh messages from database
        const updatedConversations = conversations.map(conv =>
          conv.id === id ? { ...conv, messages: loadedMessages } : conv
        )
        setConversations(updatedConversations)
      } catch (error) {
        console.error('Error loading messages for conversation:', error)
      }
    }
  }

  const handleRenameConversation = async (id: string, newTitle: string) => {
    const updatedConversations = conversations.map(conv =>
      conv.id === id ? { ...conv, title: newTitle } : conv
    )
    setConversations(updatedConversations)
    saveConversationsLocally(updatedConversations)

    if (isAuthenticated) {
      try {
        await updateConversation(id, { title: newTitle })
      } catch (error) {
        console.error('Error updating conversation title:', error)
      }
    }
  }

  const handleRenameProject = async (id: string, newName: string) => {
    await handleUpdateProject(id, { name: newName })
  }

  const handleExpandedProjectsChange = (newExpandedProjects: Record<string, boolean>) => {
    setExpandedProjects(newExpandedProjects)
  }

  const handleDeleteConversation = async (id: string) => {
    try {
      // Remove from local state
      const updatedConversations = conversations.filter(conv => conv.id !== id)
      setConversations(updatedConversations)
      saveConversationsLocally(updatedConversations)

      // If this was the current conversation, switch to another one or clear current ID
      if (currentConversationId === id) {
        if (updatedConversations.length > 0) {
          setCurrentConversationId(updatedConversations[0].id)
        } else {
          // Don't create a new conversation - just clear the current ID
          setCurrentConversationId("")
        }
      }

      // Delete from database if authenticated
      if (isAuthenticated) {
        await deleteConversationWithMessages(id)
      }
    } catch (error) {
      console.error('Error deleting conversation:', error)
      // Reload conversations to ensure consistency
      if (isAuthenticated && user) {
        await loadUserData()
      }
    }
  }

  const handleSendMessage = async (
    message: string, 
    attachments?: any[], 
    webSearchEnabled?: boolean, 
    codeGenerationEnabled?: boolean
  ) => {
    if (!message.trim() && !attachments?.length) return

    // Create a conversation if none exists
    let activeConversationId = currentConversationId
    let workingConversations = conversations

    if (conversations.length === 0 || !currentConversationId) {
      // Create a new conversation immediately with the message as title
      const title = message.slice(0, 50) + (message.length > 50 ? '...' : '')
      
      // Only assign to project if it's both selected AND expanded
      const shouldAssignToProject = selectedProjectId && expandedProjects[selectedProjectId]
      
      const newConversation: UIConversation = {
        id: Date.now().toString(),
        title: title,
        model: currentModel,
        messages: [],
        user_id: user?.id || "local",
        project_id: shouldAssignToProject ? selectedProjectId : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      if (isAuthenticated && user) {
        try {
          const dbConversation = await createConversation({
            title: newConversation.title,
            model: newConversation.model,
            user_id: user.id,
            project_id: shouldAssignToProject ? selectedProjectId : null
          })
          newConversation.id = dbConversation.id
          newConversation.created_at = dbConversation.created_at
          newConversation.updated_at = dbConversation.updated_at
        } catch (error) {
          console.error('Error creating conversation in database:', error)
        }
      }

      workingConversations = [...conversations, newConversation]
      activeConversationId = newConversation.id
      setConversations(workingConversations)
      setCurrentConversationId(activeConversationId)
      saveConversationsLocally(workingConversations)
    }

    // Check if any models are available
    const availableModels = getAvailableModels()
    if (availableModels.length === 0) {
      // Create info message to guide user
      const infoMessage = {
        id: Date.now().toString(),
        content: "👋 Welcome to T3 Chat! To start chatting, please configure an API key:\n\n1. Click the ⚙️ Settings button in the top-right\n2. Go to the 'Models' tab\n3. Add your API key for any provider (OpenAI, Claude, Gemini, etc.)\n4. Select which models you want to use\n\nOnce configured, you'll be able to chat with AI models!",
        role: 'assistant' as const,
        timestamp: new Date(),
        isError: false
      }

      const infoConversations = workingConversations.map(conv =>
        conv.id === activeConversationId
          ? {
              ...conv,
              messages: [...conv.messages, infoMessage],
              updated_at: new Date().toISOString()
            }
          : conv
      )
      setConversations(infoConversations)
      saveConversationsLocally(infoConversations)
      return
    }

    // Clean up any existing error messages from the current conversation
    const cleanedConversations = workingConversations.map(conv =>
      conv.id === activeConversationId
        ? {
            ...conv,
            messages: conv.messages.filter(msg => !msg.isError)
          }
        : conv
    )
    setConversations(cleanedConversations)

    // Create user message
    const userMessage: UIMessage = {
      id: Date.now().toString(),
      content: message,
      role: "user",
      timestamp: new Date(),
      attachments,
      model: currentModel
    }

    // Add user message to conversation (using cleaned conversations)
    const updatedConversations = cleanedConversations.map(conv =>
      conv.id === activeConversationId
        ? {
            ...conv,
            messages: [...conv.messages, userMessage],
            updated_at: new Date().toISOString()
          }
        : conv
    )
    setConversations(updatedConversations)
    saveConversationsLocally(updatedConversations)

    setIsTyping(true)

    try {
      // Save user message to database if authenticated
      if (isAuthenticated && user) {
        await createMessage({
          content: message,
          role: 'user',
          conversation_id: activeConversationId,
          model: currentModel,
          provider: getProviderFromModel(currentModel),
          attachments: attachments || []
        })
      }

      // Get provider and API key for current model
      const provider = getProviderFromModel(currentModel)
      const apiKey = getApiKeyForModel(currentModel, userSettings)
      
      if (!provider || !apiKey) {
        throw new Error(`Please configure an API key for ${provider || 'this model'} in Settings → Models`)
      }

      // Filter out error messages before sending to API
      const currentConv = updatedConversations.find(conv => conv.id === activeConversationId)
      const cleanMessages = (currentConv?.messages || [])
        .filter(msg => !msg.isError) // Remove error messages
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }))

      // Make API call to get AI response
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: cleanMessages,
          provider: provider,
          apiKey: apiKey,
          model: currentModel,
          temperature: userSettings.temperature,
          webSearchEnabled,
          codeGenerationEnabled
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      // Create assistant message with proper content validation
      const assistantMessage: UIMessage = {
        id: (Date.now() + 1).toString(),
        content: data.content || data.response || "I apologize, but I couldn't generate a response. Please try again.",
        role: "assistant",
        timestamp: new Date(),
        model: currentModel,
        provider: getProviderFromModel(currentModel),
        searchResults: data.searchResults
      }

      // Add assistant message to conversation
      const finalConversations = updatedConversations.map(conv =>
        conv.id === activeConversationId
          ? {
              ...conv,
              messages: [...conv.messages, assistantMessage],
              updated_at: new Date().toISOString()
            }
          : conv
      )
      setConversations(finalConversations)
      saveConversationsLocally(finalConversations)

      // Save assistant message to database if authenticated (with content validation)
      if (isAuthenticated && user) {
        const messageContent = data.content || data.response || "I apologize, but I couldn't generate a response. Please try again."
        await createMessage({
          content: messageContent,
          role: 'assistant',
          conversation_id: activeConversationId,
          model: currentModel,
          provider: getProviderFromModel(currentModel),
          search_results: data.searchResults || []
        })

        // Update conversation timestamp
        await updateConversation(activeConversationId, { 
          updated_at: new Date().toISOString() 
        })
      }

    } catch (error) {
      console.error('Error sending message:', error)
      
      // Create error message in local state
      const errorMessage = {
        id: Date.now().toString(),
        content: error instanceof Error ? error.message : 'An error occurred',
        role: 'assistant' as const,
        timestamp: new Date(),
        isError: true,
        retryData: {
          originalMessage: message,
          attachments
        }
      }

      const errorConversations = updatedConversations.map(conv =>
        conv.id === activeConversationId
          ? {
              ...conv,
              messages: [...conv.messages, errorMessage],
              updated_at: new Date().toISOString()
            }
          : conv
      )
      setConversations(errorConversations)
      saveConversationsLocally(errorConversations)
    } finally {
      setIsTyping(false)
    }
  }

  // Helper functions
  const getApiKeyForModel = (modelId: string, settings: UserSettings): string | null => {
    const provider = getProviderFromModel(modelId)
    
    switch (provider) {
      case 'openai':
        return settings.openaiApiKey
      case 'claude':
        return settings.claudeApiKey
      case 'gemini':
        return settings.geminiApiKey
      case 'deepseek':
        return settings.deepseekApiKey
      case 'grok':
        return settings.grokApiKey
      case 'openrouter':
        return settings.openrouterApiKey
      case 'veo2':
        return settings.geminiApiKey // VEO2 uses Google's API key
      case 'mistral':
        return settings.mistralApiKey
      default:
        return null
    }
  }

  const getProviderFromModel = (modelId: string): string => {
    if (modelId.includes('gpt') || modelId.includes('o3')) return 'openai'
    if (modelId.includes('claude')) return 'claude'
    if (modelId.includes('gemini')) return 'gemini'
    if (modelId.includes('veo2')) return 'veo2'
    if (modelId.includes('deepseek')) return 'deepseek'
    if (modelId.includes('grok')) return 'grok'
    if (modelId.includes('mistral') || modelId.includes('codestral')) return 'mistral'
    return 'openrouter' // fallback
  }

  // Handle logout
  const handleLogout = async () => {
    try {
      await signOut()
      // Clear authenticated state but keep local conversations
      setProjects([])
      setSelectedProjectId(null)
      // Keep current conversations in local mode
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  // Handle login
  const handleLogin = () => {
    setShowAuthModal(true)
  }

  // Get current conversation
  const currentConversation = conversations.find(conv => conv.id === currentConversationId) || null

  // Helper function to get available models based on settings
  const getAvailableModelsForSettings = (settings: UserSettings) => {
    const models: Model[] = []
    
    // Add models based on available API keys in priority order
    if (settings.openaiApiKey) {
      models.push(
        { id: "o3", name: "o3", icon: "O3", provider: "openai" },
        { id: "gpt-4.5", name: "GPT-4.5", icon: "45", provider: "openai" },
        { id: "gpt-4.1", name: "GPT-4.1", icon: "41", provider: "openai" },
        { id: "gpt-4", name: "GPT-4", icon: "G4", provider: "openai" },
        { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", icon: "35", provider: "openai" }
      )
    }
    
    if (settings.claudeApiKey) {
      models.push(
        { id: "claude-4-sonnet", name: "Claude 4 Sonnet", icon: "C4", provider: "claude" },
        { id: "claude-3.5-opus", name: "Claude 3.5 Opus", icon: "CO", provider: "claude" },
        { id: "claude-3.5-sonnet", name: "Claude 3.5 Sonnet", icon: "C3", provider: "claude" }
      )
    }
    
    if (settings.geminiApiKey) {
      models.push(
        { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", icon: "G2", provider: "gemini" },
        { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", icon: "GP", provider: "gemini" },
        { id: "veo2", name: "VEO 2", icon: "V2", provider: "veo2" }
      )
    }
    
    if (settings.deepseekApiKey) {
      models.push(
        { id: "deepseek-v3", name: "DeepSeek V3", icon: "D3", provider: "deepseek" }
      )
    }
    
    if (settings.grokApiKey) {
      models.push(
        { id: "grok-3", name: "Grok 3", icon: "G3", provider: "grok" }
      )
    }
    
    if (settings.mistralApiKey) {
      models.push(
        { id: "mistral-large", name: "Mistral Large", icon: "ML", provider: "mistral" },
        { id: "mistral-medium", name: "Mistral Medium", icon: "MM", provider: "mistral" },
        { id: "mistral-small", name: "Mistral Small", icon: "MS", provider: "mistral" },
        { id: "codestral", name: "Codestral", icon: "CS", provider: "mistral" }
      )
    }
    
    return models
  }

  // Generate available models based on API keys
  const getAvailableModels = () => {
    return getAvailableModelsForSettings(userSettings)
  }

  // Don't show loading spinner - always show the main UI
  if (!isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* Main Chat Interface */}
      <div className="flex-1">
        <MainUI
          conversations={conversations.map(conv => ({
            id: conv.id,
            title: conv.title,
            timestamp: new Date(conv.updated_at),
            model: conv.model,
            messages: conv.messages
          }))}
          projects={projects.map(proj => ({
            id: proj.id,
            name: proj.name,
            conversations: conversations
              .filter(conv => conv.project_id === proj.id)
              .map(conv => conv.id)
          }))}
          models={getAvailableModels()}
          currentConversation={currentConversation ? {
            id: currentConversation.id,
            title: currentConversation.title,
            timestamp: new Date(currentConversation.updated_at),
            model: currentConversation.model,
            messages: currentConversation.messages
          } : {
            id: "empty",
            title: "No Conversation",
            timestamp: new Date(),
            model: currentModel,
            messages: []
          }}
          currentModel={currentModel}
          userSettings={userSettings}
          isTyping={isTyping}
          onSendMessage={handleSendMessage}
          onSelectConversation={handleSelectConversation}
          onSelectModel={setCurrentModel}
          onCreateConversation={handleCreateConversation}
          onCreateProject={() => handleCreateProject('New Project')}
          onSelectProject={handleSelectProject}
          onRenameProject={handleRenameProject}
          onDeleteProject={handleDeleteProject}
          onMoveConversation={handleMoveConversation}
          onToggleTheme={() => {/* Handle theme toggle */}}
          onLogout={isAuthenticated ? handleLogout : undefined}
          onLogin={!isAuthenticated ? handleLogin : undefined}
          isAuthenticated={isAuthenticated}
          user={user}
          authLoading={authLoading || dataLoading}
          selectedProjectId={selectedProjectId}
          onSaveSettings={(settings) => {
            setUserSettings(settings)
            if (typeof window !== 'undefined') {
              localStorage.setItem('t3-chat-user-settings', JSON.stringify(settings))
            }
          }}
          onRenameConversation={handleRenameConversation}
          onDeleteConversation={handleDeleteConversation}
          onRetryMessage={(messageId: string) => {
            // Implement retry logic
            console.log('Retry message:', messageId)
          }}
          onExpandedProjectsChange={handleExpandedProjectsChange}
        />
      </div>

      {/* Auth Modal */}
      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
    </div>
  )
}
