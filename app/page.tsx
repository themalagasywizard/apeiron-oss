"use client"

import { useState, useEffect } from "react"
import MainUI from "@/main-ui"
import { AuthModal } from "@/components/AuthModal"
import { ProjectSidebar } from "@/components/ProjectSidebar"
import { useAuth } from "@/hooks/useAuth"
import {
  getProjects,
  getConversations,
  getMessages,
  createProject,
  createConversation,
  createMessage,
  updateConversation,
  updateProject,
  deleteProject,
  deleteConversation,
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
    enabledSubModels: {}
  })
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [projects, setProjects] = useState<DBProject[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [dataLoading, setDataLoading] = useState(false)
  const [migrationCompleted, setMigrationCompleted] = useState(false)

  // Load settings and set client flag on mount
  useEffect(() => {
    // Immediately redirect to production if on localhost with auth-related parameters
    const currentUrl = window.location.href
    if (window.location.hostname === 'localhost') {
      const url = new URL(currentUrl)
      const hasAuthParams = url.searchParams.has('code') || 
                           url.searchParams.has('error') || 
                           url.searchParams.has('state') ||
                           currentUrl.includes('#access_token=')
      
      if (hasAuthParams) {
        // Redirect to production preserving all query parameters and fragments
        const redirectUrl = currentUrl.replace('http://localhost:3000', 'https://t3-oss.netlify.app')
        console.log('Redirecting to production:', redirectUrl)
        window.location.replace(redirectUrl)
        return
      }
    }

    // Clean up URL fragments immediately if present
    const cleanUpUrlFragments = () => {
      const currentUrl = window.location.href
      if (currentUrl.includes('#access_token=') || currentUrl.includes('#error=')) {
        // Clean up the URL by removing the fragment
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search)
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
        enabledSubModels: {}
      }
    }

    // Clean up URL fragments first
    cleanUpUrlFragments()
    
    setUserSettings(loadSettings())
    setIsClient(true) // Set client to true after settings are loaded
  }, [])

  // Load data when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      loadUserData()
    } else if (!isAuthenticated && !authLoading) {
      // Show auth modal if not authenticated
      setShowAuthModal(true)
    }
  }, [isAuthenticated, user, authLoading])

  const loadUserData = async () => {
    if (!user) return

    setDataLoading(true)
    try {
      // Load projects
      const userProjects = await getProjects(user.id)
      setProjects(userProjects)

      // Load conversations
      const userConversations = await getConversations(user.id)
      
      // Load messages for each conversation
      const conversationsWithMessages = await Promise.all(
        userConversations.map(async (conv) => {
          const messages = await getMessages(conv.id)
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

      setConversations(conversationsWithMessages)

      // Set current conversation if none selected
      if (conversationsWithMessages.length > 0 && !currentConversationId) {
        setCurrentConversationId(conversationsWithMessages[0].id)
      }

      // Migrate local data if not already done
      const migrated = localStorage.getItem('t3-chat-migrated')
      if (!migrated && !migrationCompleted) {
        await migrateLocalDataToSupabase(user.id)
        setMigrationCompleted(true)
        // Reload data after migration
        await loadUserData()
      }

    } catch (error) {
      console.error('Error loading user data:', error)
    } finally {
      setDataLoading(false)
    }
  }

  // Project management functions
  const handleCreateProject = async (name: string, description?: string) => {
    if (!user) return

    try {
      const newProject = await createProject({
        user_id: user.id,
        name,
        description: description || null,
        color: '#6366f1'
      })
      
      setProjects(prev => [newProject, ...prev])
    } catch (error) {
      console.error('Error creating project:', error)
    }
  }

  const handleUpdateProject = async (id: string, updates: Partial<DBProject>) => {
    try {
      const updatedProject = await updateProject(id, updates)
      setProjects(prev => prev.map(p => p.id === id ? updatedProject : p))
    } catch (error) {
      console.error('Error updating project:', error)
    }
  }

  const handleDeleteProject = async (id: string) => {
    try {
      await deleteProject(id)
      setProjects(prev => prev.filter(p => p.id !== id))
      
      // Move conversations from deleted project to unorganized
      setConversations(prev => prev.map(conv => 
        conv.project_id === id 
          ? { ...conv, project_id: null }
          : conv
      ))
    } catch (error) {
      console.error('Error deleting project:', error)
    }
  }

  const handleSelectProject = (projectId: string | null) => {
    setSelectedProjectId(projectId)
    
    // Find first conversation in selected project
    const projectConversations = conversations.filter(conv => 
      conv.project_id === projectId
    )
    
    if (projectConversations.length > 0) {
      setCurrentConversationId(projectConversations[0].id)
    }
  }

  const handleMoveConversation = async (conversationId: string, projectId: string | null) => {
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

  // Conversation management functions
  const handleCreateConversation = async () => {
    if (!user) return

    try {
      const newConversation = await createConversation({
        user_id: user.id,
        project_id: selectedProjectId,
        title: 'New Conversation',
        model: currentModel
      })

      const conversationWithMessages = {
        ...newConversation,
        messages: []
      }

      setConversations(prev => [conversationWithMessages, ...prev])
      setCurrentConversationId(newConversation.id)
    } catch (error) {
      console.error('Error creating conversation:', error)
    }
  }

  const handleSelectConversation = (id: string) => {
    setCurrentConversationId(id)
  }

  const handleRenameConversation = async (id: string, newTitle: string) => {
    try {
      await updateConversation(id, { title: newTitle })
      
      setConversations(prev => prev.map(conv =>
        conv.id === id ? { ...conv, title: newTitle } : conv
      ))
    } catch (error) {
      console.error('Error renaming conversation:', error)
    }
  }

  // Enhanced message sending with database storage and AI response handling
  const handleSendMessage = async (
    message: string, 
    attachments?: any[], 
    webSearchEnabled?: boolean, 
    codeGenerationEnabled?: boolean
  ) => {
    if (!user || !currentConversationId) return

    setIsTyping(true)

    try {
      // Create user message in database
      const userMessage = await createMessage({
        conversation_id: currentConversationId,
        role: 'user',
        content: message,
        attachments: attachments || null,
        timestamp: new Date().toISOString()
      })

      // Update local state with user message
      setConversations(prev => prev.map(conv =>
        conv.id === currentConversationId
          ? {
              ...conv,
              messages: [...conv.messages, {
                id: userMessage.id,
                content: userMessage.content,
                role: userMessage.role as "user" | "assistant",
                timestamp: new Date(userMessage.timestamp),
                attachments: userMessage.attachments as any[] || undefined
              }]
            }
          : conv
      ))

      // Get API key for the current model
      const currentModelData = userSettings.models.find(m => m.id === currentModel)
      const apiKey = getApiKeyForModel(currentModel, userSettings)
      
      if (!apiKey) {
        throw new Error(`No API key found for ${currentModel}. Please configure your API keys in settings.`)
      }

      // Prepare messages for AI API
      const conversation = conversations.find(conv => conv.id === currentConversationId)
      const allMessages = [...(conversation?.messages || []), {
        id: userMessage.id,
        content: userMessage.content,
        role: userMessage.role as "user" | "assistant",
        timestamp: new Date(userMessage.timestamp),
        attachments: userMessage.attachments as any[] || undefined
      }]

      const messagesForAI = allMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      // Determine API endpoint
      const apiEndpoint = codeGenerationEnabled ? '/api/edge-functions/generate-code' : '/api/chat'
      
      // Call AI API
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: messagesForAI,
          provider: getProviderFromModel(currentModel),
          apiKey,
          model: currentModel,
          temperature: userSettings.temperature,
          customModelName: currentModelData?.customModelName,
          webSearchEnabled
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'AI request failed')
      }

      const aiData = await response.json()
      
      // Create AI message in database
      const aiMessage = await createMessage({
        conversation_id: currentConversationId,
        role: 'assistant',
        content: aiData.response,
        search_results: aiData.searchResults || null,
        timestamp: new Date().toISOString()
      })

      // Update local state with AI response
      setConversations(prev => prev.map(conv =>
        conv.id === currentConversationId
          ? {
              ...conv,
              messages: [...conv.messages, {
                id: aiMessage.id,
                content: aiMessage.content,
                role: aiMessage.role as "user" | "assistant",
                timestamp: new Date(aiMessage.timestamp),
                searchResults: aiMessage.search_results as any[] || undefined,
                model: currentModel,
                provider: getProviderFromModel(currentModel)
              }]
            }
          : conv
      ))

      // Update conversation timestamp and title if it's the first message
      const updateData: any = { updated_at: new Date().toISOString() }
      if (conversation && conversation.messages.length === 0) {
        updateData.title = message.slice(0, 50) + (message.length > 50 ? '...' : '')
      }
      
      await updateConversation(currentConversationId, updateData)

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

      setConversations(prev => prev.map(conv =>
        conv.id === currentConversationId
          ? {
              ...conv,
              messages: [...conv.messages, errorMessage]
            }
          : conv
      ))
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
      // Clear local state
      setConversations([])
      setProjects([])
      setCurrentConversationId("")
      setSelectedProjectId(null)
      setShowAuthModal(true)
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  // Get current conversation with database integration
  const currentConversation = conversations.find(conv => conv.id === currentConversationId) || {
    id: "default",
    title: "New Conversation",
    timestamp: new Date(),
    model: currentModel,
    messages: [],
    user_id: user?.id || "",
    project_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  // Show loading spinner during auth
  if (authLoading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            {authLoading ? 'Checking authentication...' : 'Loading your data...'}
          </p>
        </div>
      </div>
    )
  }

  // Show auth modal if not authenticated
  if (!isAuthenticated) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">Welcome to T3 Chat</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              Please sign in to access your conversations and projects
            </p>
          </div>
        </div>
        <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
      </>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex">
      {/* Project Sidebar */}
      <ProjectSidebar
        projects={projects}
        conversations={conversations}
        selectedProjectId={selectedProjectId}
        selectedConversationId={currentConversationId}
        onCreateProject={handleCreateProject}
        onSelectProject={handleSelectProject}
        onSelectConversation={handleSelectConversation}
        onUpdateProject={handleUpdateProject}
        onDeleteProject={handleDeleteProject}
        onMoveConversation={handleMoveConversation}
        onCreateConversation={handleCreateConversation}
      />

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
          onLogout={handleLogout}
          onSaveSettings={(settings) => {
            setUserSettings(settings)
            if (typeof window !== 'undefined') {
              localStorage.setItem('t3-chat-user-settings', JSON.stringify(settings))
            }
          }}
          onRenameConversation={handleRenameConversation}
          onRetryMessage={(messageId: string) => {
            // Implement retry logic
            console.log('Retry message:', messageId)
          }}
        />
      </div>
    </div>
  )
}
