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
    originalSettings: {
      webSearchEnabled: boolean
      codeGenerationEnabled: boolean
      enhancedWebSearch: boolean
      userLocation: string | null
    }
  }
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
  subModels?: string[]
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
  enabledSubModels: { [provider: string]: string[] }
  selectedTheme?: string
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
    runwayApiKey: "",
    enabledSubModels: {}
  })
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [projects, setProjects] = useState<UIProject[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({})
  const [dataLoading, setDataLoading] = useState(false)
  const [migrationCompleted, setMigrationCompleted] = useState(false)
  const loadingRef = useRef(false)
  
  // Add global error handlers for unhandled errors and rejections
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      event.preventDefault(); // Prevent the default browser behavior
      
      // Handle different types of rejection reasons
      const reason = event.reason;
      let errorMessage = "Unknown error occurred";
      let errorDetails = null;
      
      if (reason instanceof Error) {
        errorMessage = reason.message;
        errorDetails = reason.stack;
      } else if (reason instanceof Event) {
        errorMessage = `Event error: ${reason.type}`;
        try {
          errorDetails = JSON.stringify(reason);
        } catch {
          errorDetails = "Event details not serializable";
        }
      } else if (typeof reason === 'string') {
        errorMessage = reason;
      } else if (typeof reason === 'object' && reason !== null) {
        try {
          errorMessage = JSON.stringify(reason);
        } catch {
          errorMessage = "Object error not serializable";
        }
      }
      
      console.error("[ERROR] Unhandled promise rejection:", {
        message: errorMessage,
        details: errorDetails,
        type: reason?.constructor?.name || typeof reason
      });
    };
    
    const handleError = (event: ErrorEvent) => {
      event.preventDefault(); // Prevent the default browser behavior
      
      console.error("[ERROR] Unhandled error:", {
        message: event.message,
        filename: event.filename,
        lineNumber: event.lineno,
        columnNumber: event.colno,
        error: event.error,
        type: event.type
      });
    };
    
    // Add the event listeners
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("error", handleError);
    
    // Clean up the event listeners when component unmounts
    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.removeEventListener("error", handleError);
    };
  }, []);

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
        const saved = localStorage.getItem("apeiron-user-settings")
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
            runwayApiKey: parsed.runwayApiKey || "",
            enabledSubModels: parsed.enabledSubModels || {}
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
        runwayApiKey: "",
        enabledSubModels: {}
      }
    }

    const loadLocalConversations = () => {
      try {
        const saved = localStorage.getItem("apeiron-conversations")
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
        const saved = localStorage.getItem("apeiron-projects")
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
    
    // Apply basic theme classes
    document.documentElement.classList.add('theme-basic', 'dark')
    
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
      const migrated = localStorage.getItem('apeiron-migrated')
      const needsMigration = !migrated && !migrationCompleted
      
      if (needsMigration) {
        console.log('Starting local data migration...')
        await migrateLocalDataToSupabase(user.id)
        setMigrationCompleted(true)
        localStorage.setItem('apeiron-migrated', 'true')
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
        localStorage.setItem("apeiron-conversations", JSON.stringify(localConversations))
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
        localStorage.setItem("apeiron-projects", JSON.stringify(localProjects))
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
    attachments?: ProcessedFile[], 
    webSearchEnabled: boolean = false, 
    codeGenerationEnabled: boolean = false,
    userLocation: string | null = null,
    enhancedWebSearch: boolean = false,
    overrideModel?: string
  ) => {
    try {
      if (!message.trim() && !attachments?.length) return

      // Use the override model if provided, otherwise use currentModel
      const modelToUse = overrideModel || currentModel;
      
      // Special handling for OpenRouter - ensure we're using the correct model ID
      let finalModelToUse = modelToUse;
      let providerToUse = getProviderFromModel(finalModelToUse);
      
      if (userSettings.openrouterEnabled) {
        // Use the OpenRouter model name if available, otherwise use a default
        finalModelToUse = userSettings.openrouterModelName || "anthropic/claude-3-sonnet";
        
        // If the model doesn't have a provider prefix, add it
        if (!finalModelToUse.includes('/')) {
          if (finalModelToUse.includes('gpt')) {
            finalModelToUse = `openai/${finalModelToUse}`;
          } else if (finalModelToUse.includes('claude')) {
            finalModelToUse = `anthropic/${finalModelToUse}`;
          } else if (finalModelToUse.includes('gemini')) {
            finalModelToUse = `google/${finalModelToUse}`;
          } else if (finalModelToUse.includes('mistral')) {
            finalModelToUse = `mistral/${finalModelToUse}`;
          } else if (finalModelToUse.includes('llama')) {
            finalModelToUse = `meta-llama/${finalModelToUse}`;
          }
        }
        console.log("[DEBUG] Using OpenRouter model:", finalModelToUse);
        
        // Force provider to be openrouter when in OpenRouter mode
        providerToUse = "openrouter";
      }

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
          model: finalModelToUse,
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
            console.error('[ERROR] Failed to create conversation in database:', error)
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
          content: "👋 Welcome to Apeiron! To start chatting, please configure an API key:\n\n1. Click the ⚙️ Settings button in the bottom-left\n2. Go to the 'Models' tab\n3. Add your API key for any provider (OpenAI, Claude, Gemini, etc.) or OpenRouter\n4. Select which models you want to use\n\nOnce configured, you'll be able to chat with AI models!",
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
        model: finalModelToUse
      }

      // Add user message to conversation (using cleaned conversations)
      const updatedConversations = cleanedConversations.map(conv =>
        conv.id === activeConversationId
          ? {
              ...conv,
              messages: [...conv.messages, userMessage],
              model: finalModelToUse,
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
            model: finalModelToUse,
            provider: getProviderFromModel(finalModelToUse),
            attachments: attachments || []
          })
        }

        // Get provider and API key for current model
        const provider = providerToUse || getProviderFromModel(finalModelToUse)
        let apiKey = getApiKeyForModel(finalModelToUse, userSettings)

        // Special handling for OpenRouter
        if (userSettings.openrouterEnabled) {
          console.log("[DEBUG] OpenRouter mode is enabled")
          console.log("[DEBUG] Selected model:", finalModelToUse)
          apiKey = userSettings.openrouterApiKey
          console.log("[DEBUG] Using OpenRouter API key:", apiKey ? "Key exists" : "No key")
          console.log("[DEBUG] Using provider:", provider)
        }

        if (!provider || !apiKey) {
          console.error("[ERROR] Missing provider or API key:", { provider, hasApiKey: !!apiKey })
          throw new Error(`Please configure an API key for ${provider || 'this model'} in Settings → Models`)
        }

        // Filter out error messages before sending to API
        const currentConv = updatedConversations.find(conv => conv.id === activeConversationId)
        const cleanMessages = (currentConv?.messages || [])
          .filter(msg => !msg.isError) // Remove error messages
          .map(msg => ({
            role: msg.role,
            content: msg.content,
            attachments: msg.attachments // Include attachments
          }))

        // Prepare headers with location data if available
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        };
        
        if (webSearchEnabled && userLocation) {
          headers['x-user-location'] = userLocation;
        }

        // Make API call to get AI response
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            messages: cleanMessages,
            provider: provider,
            apiKey: apiKey,
            model: finalModelToUse,
            temperature: userSettings.temperature,
            webSearchEnabled,
            codeGenerationEnabled: codeGenerationEnabled || false, // Ensure it's a boolean
            enhancedWebSearch,
            // Include all individual API keys for image generation routing
            openaiApiKey: userSettings.openaiApiKey,
            claudeApiKey: userSettings.claudeApiKey,
            geminiApiKey: userSettings.geminiApiKey,
            deepseekApiKey: userSettings.deepseekApiKey,
            grokApiKey: userSettings.grokApiKey,
            veo2ApiKey: userSettings.veo2ApiKey,
            mistralApiKey: userSettings.mistralApiKey,
            runwayApiKey: userSettings.runwayApiKey
          }),
        }).catch(error => {
          console.error("[ERROR] Fetch error:", error);
          throw new Error(`Network error: ${error.message || "Failed to connect to API"}`);
        });

        if (!response.ok) {
          const errorText = await response.text().catch(e => "Could not read error response");
          console.error(`[ERROR] HTTP error ${response.status}:`, errorText);
          throw new Error(`HTTP error! status: ${response.status}. ${errorText}`);
        }

        const data = await response.json().catch(error => {
          console.error("[ERROR] JSON parse error:", error);
          throw new Error("Failed to parse API response");
        });

        // Create assistant message with proper content validation
        const assistantMessage: UIMessage = {
          id: Date.now().toString(),
          content: data.response || data.content || "No response content",
          role: "assistant",
          timestamp: new Date(),
          model: finalModelToUse,
          provider: provider,
          searchResults: data.searchResults
        }

        // Add assistant message to conversation
        const finalConversations = updatedConversations.map(conv =>
          conv.id === activeConversationId
            ? {
                ...conv,
                messages: [...conv.messages, assistantMessage],
                model: finalModelToUse,
                updated_at: new Date().toISOString()
              }
            : conv
        )
        setConversations(finalConversations)
        saveConversationsLocally(finalConversations)

        // Save assistant message to database if authenticated (with content validation)
        if (isAuthenticated && user) {
          try {
            const messageContent = data.content || data.response || "I apologize, but I couldn't generate a response. Please try again."
            await createMessage({
              content: messageContent,
              role: 'assistant',
              conversation_id: activeConversationId,
              model: finalModelToUse,
              provider: getProviderFromModel(finalModelToUse),
              search_results: data.searchResults || []
            })

            // Update conversation timestamp
            await updateConversation(activeConversationId, { 
              updated_at: new Date().toISOString() 
            })
          } catch (dbError) {
            console.error("[ERROR] Failed to save assistant message to database:", dbError);
            // Continue execution - this is not critical for the user experience
          }
        }

      } catch (error) {
        console.error('[ERROR] Error sending message:', error)
        
        // Create error message in local state
        const errorMessage = {
          id: Date.now().toString(),
          content: error instanceof Error ? error.message : 
                  error instanceof Event ? 'Network error occurred. Please check your connection and try again.' :
                  'An error occurred',
          role: 'assistant' as const,
          timestamp: new Date(),
          isError: true,
          retryData: {
            originalMessage: message,
            attachments,
            originalSettings: {
              webSearchEnabled,
              codeGenerationEnabled: codeGenerationEnabled || false, // Ensure it's a boolean
              enhancedWebSearch,
              userLocation
            }
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
    } catch (outerError) {
      // Catch any unhandled errors in the outer scope
      console.error("[ERROR] Unhandled error in handleSendMessage:", outerError);
      setIsTyping(false);
    }
  }

  // Helper functions
  const getApiKeyForModel = (modelId: string, settings: UserSettings): string | null => {
    // Get provider from model ID
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
        // Use VEO2 API key if available, otherwise fall back to Gemini API key
        return settings.veo2ApiKey || settings.geminiApiKey
      case 'mistral':
        return settings.mistralApiKey
      case 'runway':
        return settings.runwayApiKey
      default:
        return null
    }
  }

  const getProviderFromModel = (modelId: string): string => {
    console.log("[DEBUG] Getting provider for model:", modelId)
    console.log("[DEBUG] OpenRouter enabled:", userSettings.openrouterEnabled)
    
    // Check if OpenRouter is enabled
    if (userSettings.openrouterEnabled) {
      console.log("[DEBUG] Using OpenRouter provider due to enabled flag")
      return 'openrouter'
    }
    
    // Special handling for OpenRouter format models (e.g. openai/gpt-4, anthropic/claude-3)
    if (modelId && modelId.includes('/')) {
      console.log("[DEBUG] Using OpenRouter provider due to model ID format")
      return 'openrouter'
    }
    
    // Standard provider detection
    if (!modelId) {
      console.log("[DEBUG] No model ID provided, defaulting to openai")
      return 'openai'
    }
    
    if (modelId.includes('claude')) return 'claude'
    if (modelId.includes('gpt') || modelId.includes('o3')) return 'openai'
    if (modelId.includes('gemini')) return 'gemini'
    if (modelId.includes('veo2')) return 'veo2'
    if (modelId.includes('deepseek')) return 'deepseek'
    if (modelId.includes('grok')) return 'grok'
    if (modelId.includes('mistral') || modelId.includes('codestral')) return 'mistral'
    if (modelId.includes('gen3') || modelId.includes('gen2') || modelId.includes('runway')) return 'runway'
    
    console.log("[DEBUG] Defaulting to openai provider")
    return 'openai'
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
    
    if (settings.runwayApiKey) {
      models.push(
        { id: "gen3a-turbo", name: "Gen3 Alpha Turbo", icon: "GT", provider: "runway" },
        { id: "gen3a", name: "Gen3 Alpha", icon: "G3", provider: "runway" },
        { id: "gen2", name: "Gen2", icon: "G2", provider: "runway" }
      )
    }
    
    return models
  }

  // Generate available models based on API keys
  const getAvailableModels = () => {
    // If OpenRouter is enabled and API key exists, consider it as an available model
    if (userSettings.openrouterEnabled && userSettings.openrouterApiKey) {
      return [{
        id: userSettings.openrouterModelName || "anthropic/claude-3-sonnet",
        name: userSettings.openrouterModelName || "Claude 3 Sonnet",
        icon: "🌐",
        provider: "openrouter" as const,
        enabled: true
      }];
    }
    return getAvailableModelsForSettings(userSettings);
  }

  const handleRetryMessage = async (messageId: string, selectedModelId?: string) => {
    try {
      console.log("[DEBUG PAGE] Retrying message:", messageId);
      console.log("[DEBUG PAGE] Selected model:", selectedModelId);
      
      // Find the message to retry
      const conversation = conversations.find(conv => conv.messages.some(m => m.id === messageId));
      if (!conversation) {
        console.warn("[WARN PAGE] Could not find conversation for message:", messageId);
        return;
      }
      
      const messageIndex = conversation.messages.findIndex(m => m.id === messageId);
      if (messageIndex === -1) {
        console.warn("[WARN PAGE] Could not find message in conversation:", messageId);
        return;
      }
      
      // Find the last user message before this message
      let userMessageIndex = messageIndex - 1;
      while (userMessageIndex >= 0 && conversation.messages[userMessageIndex].role !== 'user') {
        userMessageIndex--;
      }
      
      if (userMessageIndex === -1) {
        console.warn("[WARN PAGE] Could not find user message to retry");
        return;
      }
      
      const userMessage = conversation.messages[userMessageIndex];
      console.log("[DEBUG PAGE] Found user message to retry:", {
        content: userMessage.content.slice(0, 100) + "...",
        hasAttachments: !!userMessage.attachments?.length
      });
      
      // Use the selected model if provided, otherwise use the current model
      const modelToUse = selectedModelId || currentModel;
      console.log("[DEBUG PAGE] Using model for retry:", modelToUse);
      
      try {
        // Remove all messages after the user message we're retrying
        const updatedConversations = conversations.map(conv =>
          conv.id === conversation.id
            ? {
                ...conv,
                messages: conv.messages.slice(0, userMessageIndex + 1),
                model: modelToUse, // Update the conversation model
                updated_at: new Date().toISOString()
              }
            : conv
        );
        
        setConversations(updatedConversations);
        
        try {
          saveConversationsLocally(updatedConversations);
        } catch (saveError) {
          console.error("[ERROR PAGE] Failed to save conversations after retry cleanup:", saveError);
        }
      } catch (updateError) {
        console.error("[ERROR PAGE] Failed to update conversations for retry:", updateError);
        // Continue with retry even if update fails
      }
      
      // Get the original message's settings from retryData if available
      const retrySettings = conversation.messages[messageIndex]?.retryData?.originalSettings || {
        webSearchEnabled: false,
        codeGenerationEnabled: false,
        enhancedWebSearch: false,
        userLocation: null
      };
      
      console.log("[DEBUG PAGE] Retrying with settings:", {
        webSearch: retrySettings.webSearchEnabled,
        enhancedSearch: retrySettings.enhancedWebSearch,
        location: retrySettings.userLocation
      });
      
      try {
        // Retry the message with the selected model and original settings
        // Force codeGenerationEnabled to false for retries
        await handleSendMessage(
          userMessage.content,
          userMessage.attachments,
          retrySettings.webSearchEnabled,
          false, // Always disable code generation for retries
          retrySettings.userLocation,
          retrySettings.enhancedWebSearch,
          modelToUse // Pass the selected model
        );
      } catch (sendError) {
        console.error("[ERROR PAGE] Failed to send retry message:", sendError);
        // Create error message in conversation
        const errorMessage = {
          id: Date.now().toString(),
          content: sendError instanceof Error ? sendError.message : 
                  sendError instanceof Event ? `Network error: ${sendError.type}` :
                  'Failed to retry message',
          role: "assistant" as const,
          timestamp: new Date(),
          isError: true,
          retryData: {
            originalMessage: userMessage.content,
            attachments: userMessage.attachments,
            originalSettings: retrySettings
          }
        };
        
        const errorConversations = conversations.map(conv =>
          conv.id === conversation.id
            ? {
                ...conv,
                messages: [...conv.messages, errorMessage],
                updated_at: new Date().toISOString()
              }
            : conv
        );
        
        setConversations(errorConversations);
        try {
          saveConversationsLocally(errorConversations);
        } catch (saveError) {
          console.error("[ERROR PAGE] Failed to save error message:", saveError);
        }
      }
    } catch (error) {
      console.error("[ERROR PAGE] Error in retry handler:", error);
      // Don't throw - this is a top-level error handler
    }
  };

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
          onSelectModel={(modelId: string) => {
            try {
              console.log("[DEBUG PAGE] Selecting model:", modelId);
              setCurrentModel(modelId);
              
              // If there's a current conversation, update its model
              if (currentConversationId) {
                try {
                  const updatedConversations = conversations.map(conv =>
                    conv.id === currentConversationId
                      ? {
                          ...conv,
                          model: modelId,
                          updated_at: new Date().toISOString()
                        }
                      : conv
                  );
                  setConversations(updatedConversations);
                  
                  try {
                    saveConversationsLocally(updatedConversations);
                  } catch (saveError) {
                    console.error("[ERROR PAGE] Failed to save conversations after model selection:", saveError);
                  }
                } catch (updateError) {
                  console.error("[ERROR PAGE] Failed to update conversations with new model:", updateError);
                }
              }
            } catch (error) {
              console.error("[ERROR PAGE] Error in model selection handler:", error);
            }
          }}
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
              localStorage.setItem('apeiron-user-settings', JSON.stringify(settings))
            }
          }}
          onRenameConversation={handleRenameConversation}
          onDeleteConversation={handleDeleteConversation}
          onRetryMessage={handleRetryMessage}
          onExpandedProjectsChange={handleExpandedProjectsChange}
        />
      </div>

      {/* Auth Modal */}
      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
    </div>
  )
}
