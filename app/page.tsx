"use client"

import { useState, useEffect } from "react"
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
  selectedTheme?: string // Currently selected theme
}

type UIConversation = DBConversation & {
  messages: UIMessage[]
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
  const [currentModel, setCurrentModel] = useState("gpt-4")
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
    enabledSubModels: {},
    selectedTheme: "basic"
  })
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [projects, setProjects] = useState<DBProject[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [dataLoading, setDataLoading] = useState(false)
  const [migrationCompleted, setMigrationCompleted] = useState(false)

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
            project_id: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }))
          setConversations(mappedConversations)
          if (mappedConversations.length > 0 && !currentConversationId) {
            setCurrentConversationId(mappedConversations[0].id)
          }
        }
      } catch (error) {
        console.error("Failed to load local conversations:", error)
      }
    }

    // Clean up URL fragments first
    cleanUpUrlFragments()
    
    const settings = loadSettings()
    setUserSettings(settings)
    
    // Apply saved theme
    if (settings.selectedTheme) {
      const themeClasses = ['theme-basic']
      const lightDarkClasses = ['light', 'dark']
      document.documentElement.classList.remove(...themeClasses, ...lightDarkClasses)
      
      // Always add the theme class
      document.documentElement.classList.add(`theme-${settings.selectedTheme}`)
      
      // Apply dark mode by default (light/dark can be toggled via header button)
      // Don't add 'dark' class here - let the theme be the primary style
      // Light/dark switching will be handled by adding .light class when needed
    }
    
    loadLocalConversations() // Load local conversations for non-authenticated users
    setIsClient(true) // Set client to true after settings are loaded
  }, [])

  // Load data when user is authenticated (optional)
  useEffect(() => {
    if (isAuthenticated && user && !authLoading) {
      loadUserData()
    }
  }, [isAuthenticated, user, authLoading])

  const loadUserData = async () => {
    if (!user) return

    setDataLoading(true)
    try {
      console.log('Starting loadUserData for user:', user.id)
      
      // Load projects
      console.log('Loading projects...')
      const userProjects = await getProjects(user.id)
      console.log('Projects loaded:', userProjects.length)
      setProjects(userProjects)

      // Load conversations
      console.log('Loading conversations...')
      const userConversations = await getConversations(user.id)
      console.log('Conversations loaded:', userConversations.length)
      
      // Load messages for each conversation
      console.log('Loading messages for conversations...')
      const conversationsWithMessages = await Promise.all(
        userConversations.map(async (conv) => {
          console.log(`Loading messages for conversation ${conv.id}...`)
          const messages = await getMessages(conv.id)
          console.log(`Messages loaded for ${conv.id}:`, messages.length)
          return {
            ...conv,
            messages: messages.map(msg => ({
              id: msg.id,
              content: msg.content,
              role: msg.role as "user" | "assistant",
              timestamp: new Date(msg.timestamp),
              attachments: msg.attachments as any[] || undefined,
              searchResults: msg.search_results as any[] || undefined
            }))
          }
        })
      )
      console.log('All conversations with messages loaded')

      setConversations(conversationsWithMessages)

      // Set current conversation if none selected
      if (conversationsWithMessages.length > 0 && !currentConversationId) {
        setCurrentConversationId(conversationsWithMessages[0].id)
        console.log('Set current conversation to:', conversationsWithMessages[0].id)
      }

      // Migrate local data if not already done
      const migrated = localStorage.getItem('t3-chat-migrated')
      if (!migrated && !migrationCompleted) {
        console.log('Starting local data migration...')
        await migrateLocalDataToSupabase(user.id)
        setMigrationCompleted(true)
        console.log('Migration completed, reloading data...')
        // Reload data after migration
        await loadUserData()
        return // Exit here since we're recursively calling loadUserData
      }

      console.log('loadUserData completed successfully')

    } catch (error) {
      console.error('Error loading user data:', error)
    } finally {
      console.log('Setting dataLoading to false')
      setDataLoading(false)
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
          messages: conv.messages
        }))
        localStorage.setItem("t3-chat-conversations", JSON.stringify(localConversations))
      } catch (error) {
        console.error("Failed to save conversations locally:", error)
      }
    }
  }

  const handleCreateProject = async (name: string, description?: string) => {
    if (!isAuthenticated || !user) {
      console.log('Project creation requires authentication')
      return
    }

    try {
      const newProject = await createProject({
        name,
        description: description || '',
        user_id: user.id
      })
      setProjects(prev => [...prev, newProject])
    } catch (error) {
      console.error('Error creating project:', error)
    }
  }

  const handleUpdateProject = async (id: string, updates: Partial<DBProject>) => {
    if (!isAuthenticated) return

    try {
      await updateProject(id, updates)
      setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
    } catch (error) {
      console.error('Error updating project:', error)
    }
  }

  const handleDeleteProject = async (id: string) => {
    if (!isAuthenticated) return

    try {
      await deleteProject(id)
      setProjects(prev => prev.filter(p => p.id !== id))
      
      // Update conversations that were in this project
      setConversations(prev => prev.map(conv => 
        conv.project_id === id 
          ? { ...conv, project_id: null }
          : conv
      ))
      
      if (selectedProjectId === id) {
        setSelectedProjectId(null)
      }
    } catch (error) {
      console.error('Error deleting project:', error)
    }
  }

  const handleSelectProject = (projectId: string | null) => {
    setSelectedProjectId(projectId)
    
    // Find first conversation in this project or show all if no project selected
    const projectConversations = projectId 
      ? conversations.filter(conv => conv.project_id === projectId)
      : conversations
    
    if (projectConversations.length > 0) {
      setCurrentConversationId(projectConversations[0].id)
    }
  }

  const handleMoveConversation = async (conversationId: string, projectId: string | null) => {
    if (!isAuthenticated) return

    try {
      await updateConversation(conversationId, { project_id: projectId })
      setConversations(prev => prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, project_id: projectId }
          : conv
      ))
    } catch (error) {
      console.error('Error moving conversation:', error)
    }
  }

  const handleCreateConversation = async () => {
    const newConversation: UIConversation = {
      id: Date.now().toString(),
      title: "New Conversation",
      model: currentModel,
      messages: [],
      user_id: user?.id || "local",
      project_id: selectedProjectId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    if (isAuthenticated && user) {
      try {
        const dbConversation = await createConversation({
          title: newConversation.title,
          model: newConversation.model,
          user_id: user.id,
          project_id: selectedProjectId
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
    
    // If authenticated, always ensure messages are loaded fresh from database
    if (isAuthenticated && user) {
      try {
        const conversationData = await getConversationWithMessages(id)
        if (conversationData) {
          const loadedMessages = conversationData.messages.map(msg => ({
            id: msg.id,
            content: msg.content,
            role: msg.role as "user" | "assistant",
            timestamp: new Date(msg.timestamp),
            attachments: msg.attachments as any[] || undefined,
            searchResults: msg.search_results as any[] || undefined
          }))
          
          // Update the conversation with fresh messages from database
          const updatedConversations = conversations.map(conv =>
            conv.id === id ? { ...conv, messages: loadedMessages } : conv
          )
          setConversations(updatedConversations)
        }
      } catch (error) {
        console.error('Error loading conversation with messages:', error)
        // Fallback to existing message loading
        const conversation = conversations.find(conv => conv.id === id)
        if (conversation && conversation.messages.length === 0) {
          try {
            const messages = await getMessages(id)
            const loadedMessages = messages.map(msg => ({
              id: msg.id,
              content: msg.content,
              role: msg.role as "user" | "assistant",
              timestamp: new Date(msg.timestamp),
              attachments: msg.attachments as any[] || undefined,
              searchResults: msg.search_results as any[] || undefined
            }))
            
            const updatedConversations = conversations.map(conv =>
              conv.id === id ? { ...conv, messages: loadedMessages } : conv
            )
            setConversations(updatedConversations)
          } catch (fallbackError) {
            console.error('Error in fallback message loading:', fallbackError)
          }
        }
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

  const handleDeleteConversation = async (id: string) => {
    try {
      // Remove from local state
      const updatedConversations = conversations.filter(conv => conv.id !== id)
      setConversations(updatedConversations)
      saveConversationsLocally(updatedConversations)

      // If this was the current conversation, switch to another one or create a new one
      if (currentConversationId === id) {
        if (updatedConversations.length > 0) {
          setCurrentConversationId(updatedConversations[0].id)
        } else {
          // Create a new conversation if no conversations left
          await handleCreateConversation()
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

    // Create user message
    const userMessage: UIMessage = {
      id: Date.now().toString(),
      content: message,
      role: "user",
      timestamp: new Date(),
      attachments,
      model: currentModel
    }

    // Add user message to conversation
    const updatedConversations = conversations.map(conv =>
      conv.id === currentConversationId
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
          conversation_id: currentConversationId,
          attachments: attachments || []
        })
      }

      // Make API call to get AI response
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: updatedConversations.find(conv => conv.id === currentConversationId)?.messages || [],
          model: currentModel,
          temperature: userSettings.temperature,
          webSearchEnabled,
          codeGenerationEnabled,
          settings: userSettings
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      // Create assistant message
      const assistantMessage: UIMessage = {
        id: (Date.now() + 1).toString(),
        content: data.content,
        role: "assistant",
        timestamp: new Date(),
        model: currentModel,
        searchResults: data.searchResults
      }

      // Add assistant message to conversation
      const finalConversations = conversations.map(conv =>
        conv.id === currentConversationId
          ? {
              ...conv,
              messages: [...conv.messages, userMessage, assistantMessage],
              updated_at: new Date().toISOString()
            }
          : conv
      )
      setConversations(finalConversations)
      saveConversationsLocally(finalConversations)

      // Save assistant message to database if authenticated
      if (isAuthenticated && user) {
        await createMessage({
          content: data.content,
          role: 'assistant',
          conversation_id: currentConversationId,
          search_results: data.searchResults || []
        })

        // Update conversation timestamp and title if it's the first message
        const conversation = conversations.find(conv => conv.id === currentConversationId)
        const updateData: any = { updated_at: new Date().toISOString() }
        if (conversation && conversation.messages.length === 0) {
          updateData.title = message.slice(0, 50) + (message.length > 50 ? '...' : '')
        }
        
        await updateConversation(currentConversationId, updateData)
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

      const errorConversations = conversations.map(conv =>
        conv.id === currentConversationId
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
        return settings.veo2ApiKey
      default:
        return null
    }
  }

  const getProviderFromModel = (modelId: string): string => {
    if (modelId.includes('gpt')) return 'openai'
    if (modelId.includes('claude')) return 'claude'
    if (modelId.includes('gemini') || modelId.includes('veo2')) return modelId.includes('veo2') ? 'veo2' : 'gemini'
    if (modelId.includes('deepseek')) return 'deepseek'
    if (modelId.includes('grok')) return 'grok'
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
  const currentConversation = conversations.find(conv => conv.id === currentConversationId) || {
    id: "default",
    title: "New Conversation",
    timestamp: new Date(),
    model: currentModel,
    messages: [],
    user_id: user?.id || "local",
    project_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  // Generate available models based on API keys
  const getAvailableModels = () => {
    const models: Model[] = []
    
    // Add models based on available API keys
    if (userSettings.openaiApiKey) {
      models.push(
        { id: "gpt-4", name: "GPT-4", icon: "G4", provider: "openai" },
        { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", icon: "35", provider: "openai" }
      )
    }
    
    if (userSettings.claudeApiKey) {
      models.push(
        { id: "claude-3.5-sonnet", name: "Claude 3.5 Sonnet", icon: "C3", provider: "claude" }
      )
    }
    
    if (userSettings.geminiApiKey) {
      models.push(
        { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", icon: "G2", provider: "gemini" }
      )
    }
    
    // Add more models based on other API keys...
    
    return models
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
          currentConversation={{
            id: currentConversation.id,
            title: currentConversation.title,
            timestamp: new Date(currentConversation.updated_at),
            model: currentConversation.model,
            messages: currentConversation.messages
          }}
          currentModel={currentModel}
          userSettings={userSettings}
          isTyping={isTyping}
          onSendMessage={handleSendMessage}
          onSelectConversation={handleSelectConversation}
          onSelectModel={setCurrentModel}
          onCreateConversation={handleCreateConversation}
          onCreateProject={() => handleCreateProject('New Project')}
          onToggleTheme={() => {/* Handle theme toggle */}}
          onLogout={isAuthenticated ? handleLogout : undefined}
          onLogin={!isAuthenticated ? handleLogin : undefined}
          isAuthenticated={isAuthenticated}
          user={user}
          authLoading={authLoading || dataLoading}
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
        />
      </div>

      {/* Auth Modal */}
      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
    </div>
  )
}
