"use client"

import { useState, useEffect } from "react"
import MainUI from "@/main-ui"

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

type Model = {
  id: string
  name: string
  icon: string
  apiKey?: string
  provider: "openai" | "claude" | "gemini" | "deepseek" | "grok" | "openrouter" | "veo2"
  isCustom?: boolean
  customModelName?: string
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
}

type Conversation = {
  id: string
  title: string
  timestamp: Date
  model: string
  messages: Message[]
}

export default function Home() {
  const [isClient, setIsClient] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
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
    veo2ApiKey: ""
  })

  // Load settings and set client flag on mount
  useEffect(() => {
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
            veo2ApiKey: parsed.veo2ApiKey || ""
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
        veo2ApiKey: ""
      }
    }

    setUserSettings(loadSettings())
    setIsClient(true) // Set client to true after settings are loaded
  }, [])

  // Default models (shown only if user hasn't configured API keys)
  const defaultModels: Model[] = [
    { id: "gpt-4", name: "GPT-4", icon: "AI", provider: "openai" },
    { id: "claude-3", name: "Claude 3", icon: "C", provider: "claude" },
    { id: "gemini-2.5", name: "Gemini 2.5", icon: "G", provider: "gemini" },
    { id: "deepseek", name: "DeepSeek", icon: "DS", provider: "deepseek" },
    { id: "grok", name: "Grok", icon: "GK", provider: "grok" },
    { id: "veo2", name: "VEO 2", icon: "V2", provider: "veo2" }
  ]

  // Get available models (user configured + defaults without API keys)
  const availableModels = userSettings.openrouterEnabled 
    ? [{ id: "openrouter", name: userSettings.openrouterModelName || "OpenRouter", icon: "OR", provider: "openrouter" as const }]
    : [...userSettings.models, ...defaultModels.filter(m => !userSettings.models.some(um => um.id === m.id))]

  // Unified API calling function that uses our server-side route
  const callAI = async (messages: Message[], provider: string, apiKey: string, model?: string, customModelName?: string, webSearchEnabled?: boolean) => {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        provider,
        apiKey,
        model,
        temperature: userSettings.temperature,
        customModelName,
        webSearchEnabled
      })
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `API error: ${response.statusText}`)
    }
    
    const data = await response.json()
    return data
  }

  // Find current conversation or create a default one
  const currentConversation = conversations.find((conv) => conv.id === currentConversationId) || {
    id: "default",
    title: "New Conversation",
    timestamp: new Date(),
    model: currentModel,
    messages: [],
  }

  // Handle sending a message
  const handleSendMessage = async (message: string, attachments?: ProcessedFile[], webSearchEnabled?: boolean) => {
    // Start typing indicator
    setIsTyping(true)

    // If no conversations exist, create the first one
    if (conversations.length === 0 || !currentConversationId) {
      const newId = `conv-${Date.now()}`
      const newConversation = {
        id: newId,
        title: "New Conversation",
        timestamp: new Date(),
        model: currentModel,
        messages: [],
      }
      setConversations([newConversation])
      setCurrentConversationId(newId)
      
      // Continue with the new conversation
      return handleSendMessage(message, attachments, webSearchEnabled)
    }

    // 1. Create the full message content with attachments
    let fullContent = message
    if (attachments && attachments.length > 0) {
      const attachmentContext = attachments
        .filter(att => att.extractedText)
        .map(att => `--- Attachment: ${att.name} ---\n${att.extractedText}`)
        .join('\n\n')
      
      if (attachmentContext) {
        // Prepend attachment context to the user's message
        fullContent = `${message}\n\n${attachmentContext}`
      }
    }

    // 2. Create the new user message object
    const newUserMessage = {
      id: `msg-${Date.now()}-user`,
      content: fullContent.trim(), // Use the combined content
      role: "user" as const,
      timestamp: new Date(),
      attachments: attachments, // Keep attachments for display
    }

    // 3. Add the new message to the conversation
    const updatedConversations = conversations.map((conv) => {
      if (conv.id === currentConversationId) {
        return {
          ...conv,
          messages: [...conv.messages, newUserMessage],
        }
      }
      return conv
    })
    setConversations(updatedConversations)
    
    // 4. Call the AI with the updated conversation history
    try {
      let aiResponse = ""
      const selectedModelData = availableModels.find(m => m.id === currentModel)
      
      if (!selectedModelData) {
        throw new Error("No model selected")
      }

      // Get the latest messages for the API call
      const conversationForApi = updatedConversations.find(c => c.id === currentConversationId)
      if (!conversationForApi) {
        throw new Error("Could not find current conversation.")
      }
      const allMessages = conversationForApi.messages

      // Determine which API to call based on the model provider
      let apiKey = ""
      let modelName = selectedModelData.id
      let customModelName = ""

      switch (selectedModelData.provider) {
        case "openai":
          apiKey = userSettings.openaiApiKey || ""
          if (!apiKey) {
            throw new Error("OpenAI API key not configured. Please add it in Settings > Models.")
          }
          break

        case "claude":
          apiKey = userSettings.claudeApiKey || ""
          if (!apiKey) {
            throw new Error("Claude API key not configured. Please add it in Settings > Models.")
          }
          break

        case "gemini":
          apiKey = userSettings.geminiApiKey || ""
          if (!apiKey) {
            throw new Error("Gemini API key not configured. Please add it in Settings > Models.")
          }
          break

        case "deepseek":
          apiKey = userSettings.deepseekApiKey || ""
          if (!apiKey) {
            throw new Error("DeepSeek API key not configured. Please add it in Settings > Models.")
          }
          break

        case "grok":
          apiKey = userSettings.grokApiKey || ""
          if (!apiKey) {
            throw new Error("Grok API key not configured. Please add it in Settings > Models.")
          }
          break

        case "openrouter":
          apiKey = userSettings.openrouterApiKey || ""
          customModelName = userSettings.openrouterModelName || "meta-llama/llama-3.1-8b-instruct:free"
          if (!apiKey) {
            throw new Error("OpenRouter API key not configured. Please add it in Settings > Models.")
          }
          break

        case "veo2":
          apiKey = userSettings.veo2ApiKey || userSettings.geminiApiKey || ""
          if (!apiKey) {
            throw new Error("VEO2 requires a Google API key. Please add your Gemini API key in Settings > Models.")
          }
          break

        default:
          throw new Error(`API key required. Please configure ${selectedModelData.provider} in Settings > Models.`)
      }

      // Call the unified AI API
      const apiResult = await callAI(allMessages, selectedModelData.provider, apiKey, modelName, customModelName, webSearchEnabled)
      aiResponse = apiResult.response || apiResult

      // 5. Add the AI response message
      const newAiMessage = {
        id: `msg-${Date.now()}-ai`,
        content: typeof apiResult === 'string' ? apiResult : apiResult.response,
        role: "assistant" as const,
        timestamp: new Date(),
        model: typeof apiResult === 'object' ? apiResult.model : modelName,
        provider: typeof apiResult === 'object' ? apiResult.provider : selectedModelData.provider,
      }
      
      setConversations(prevConvos => prevConvos.map(conv => {
        if (conv.id === currentConversationId) {
          return { ...conv, messages: [...conv.messages, newAiMessage] }
        }
        return conv
      }))

    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage = {
        id: `msg-${Date.now()}-error`,
        content: error instanceof Error ? error.message : "Unknown error occurred. Please try again.",
        role: "assistant" as const,
        timestamp: new Date(),
        isError: true,
        retryData: {
          originalMessage: message,
          attachments: attachments
        }
      }

      setConversations(prevConvos => prevConvos.map(conv => {
        if (conv.id === currentConversationId) {
          // Add error message without duplicating the user message
          return { ...conv, messages: [...conv.messages, errorMessage] }
        }
        return conv
      }))

    } finally {
      // Stop typing indicator when done
      setIsTyping(false)
    }
  }

  // Create a new conversation
  const handleCreateConversation = () => {
    const newId = `conv-${Date.now()}`
    const newConversation = {
      id: newId,
      title: "New Conversation",
      timestamp: new Date(),
      model: currentModel,
      messages: [],
    }

    setConversations([newConversation, ...conversations])
    setCurrentConversationId(newId)
  }

  // Save settings function
  const handleSaveSettings = (settings: UserSettings) => {
    setUserSettings(settings)
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("t3-chat-user-settings", JSON.stringify(settings))
      } catch (error) {
        console.error("Failed to save settings:", error)
      }
    }
  }

  // Rename conversation function
  const handleRenameConversation = (id: string, newTitle: string) => {
    setConversations(prev => prev.map(conv => 
      conv.id === id ? { ...conv, title: newTitle } : conv
    ))
  }

  // Retry failed message function
  const handleRetryMessage = (messageId: string) => {
    const conversation = conversations.find(c => c.id === currentConversationId)
    if (!conversation) return

    const errorMessage = conversation.messages.find(m => m.id === messageId) as Message
    if (!errorMessage?.isError || !errorMessage?.retryData) return

    // Remove the error message from the conversation
    setConversations(prev => prev.map(conv => 
      conv.id === currentConversationId 
        ? { ...conv, messages: conv.messages.filter(m => m.id !== messageId) }
        : conv
    ))

    // Retry the original message
    handleSendMessage(errorMessage.retryData.originalMessage, errorMessage.retryData.attachments)
  }

  if (!isClient) {
    // Render a loading state or null on the server to prevent hydration mismatch
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-900 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-600 border-t-blue-500" />
          <p>Loading Chat...</p>
        </div>
      </div>
    );
  }

  return (
    <MainUI
      conversations={conversations}
      projects={[]}
      currentConversation={currentConversation}
      currentModel={currentModel}
      userSettings={userSettings}
      models={availableModels}
      isTyping={isTyping}
      onSendMessage={handleSendMessage}
      onSelectConversation={setCurrentConversationId}
      onSelectModel={setCurrentModel}
      onCreateConversation={handleCreateConversation}
      onSaveSettings={handleSaveSettings}
      onRenameConversation={handleRenameConversation}
      onRetryMessage={handleRetryMessage}
    />
  )
}
