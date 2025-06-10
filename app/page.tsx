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
    veo2ApiKey: "",
    enabledSubModels: {}
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

    setUserSettings(loadSettings())
    setIsClient(true) // Set client to true after settings are loaded
  }, [])

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

  // Get available models based on user's enabled selections
  const getAvailableModels = (): Model[] => {
    if (userSettings.openrouterEnabled) {
      return [{ id: "openrouter", name: userSettings.openrouterModelName || "OpenRouter", icon: "OR", provider: "openrouter" as const }]
    }

    const availableModels: Model[] = []

    // Add models based on API keys and enabled sub-models
    Object.entries(modelLibrary).forEach(([provider, providerData]) => {
      const apiKeyField = `${provider}ApiKey` as keyof UserSettings
      const hasApiKey = userSettings[apiKeyField] as string
      const enabledSubModels = userSettings.enabledSubModels[provider] || []

      if (hasApiKey && enabledSubModels.length > 0) {
        providerData.models.forEach(model => {
          if (enabledSubModels.includes(model.id)) {
            // Special handling for VEO2 - it uses the gemini API key but is treated as veo2 provider
            const actualProvider = model.id === "veo2" ? "veo2" : provider
            
            availableModels.push({
              id: model.id,
              name: model.name,
              icon: getModelIcon(provider, model.id),
              provider: actualProvider as any,
              apiKey: hasApiKey
            })
          }
        })
      }
    })

    return availableModels
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

  const availableModels = getAvailableModels()

  // Unified API calling function that uses our server-side route
  const callAI = async (messages: Message[], provider: string, apiKey: string, model?: string, customModelName?: string, webSearchEnabled?: boolean) => {
    try {
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
      
      // Get response text first to handle parsing errors better
      const responseText = await response.text()
      
      if (!response.ok) {
        // Try to parse error response
        try {
          const errorData = JSON.parse(responseText)
          throw new Error(errorData.error || `API error: ${response.statusText}`)
        } catch (parseError) {
          // If we can't parse the error response, use the status text
          throw new Error(`API error (${response.status}): ${response.statusText}. ${responseText.length > 0 ? 'Invalid response format.' : 'Empty response.'}`)
        }
      }
      
      // Parse successful response
      try {
        if (!responseText || responseText.trim() === '') {
          throw new Error(`${provider} returned an empty response. Please try again.`)
        }
        
        const data = JSON.parse(responseText)
        return data
      } catch (parseError) {
        console.error('JSON parse error:', parseError)
        console.error('Response text (first 500 chars):', responseText.substring(0, 500))
        
        // Check if this looks like a partial response
        if (responseText.includes('"response"') || responseText.includes('"content"') || responseText.includes('"message"')) {
          throw new Error(`${provider} returned a partial response. This often happens with very long outputs. Please try with a shorter request.`)
        }
        
        throw new Error(`${provider} returned an invalid response format. Please try again.`)
      }
    } catch (error) {
      // Handle network errors and other fetch failures
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to the API. Please check your internet connection.')
      }
      
      // Re-throw other errors
      throw error
    }
  }

  // Call the Edge Function for code generation (longer timeout, higher token limits)
  const callCodeGenerationAPI = async (messages: Message[], provider: string, apiKey: string, model?: string, customModelName?: string) => {
    try {
      console.log("Attempting to use Edge Function for code generation...");
      
      const response = await fetch("/api/generate-code", {
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
          customModelName
        })
      })
      
      // Get response text first to handle parsing errors better
      const responseText = await response.text()
      
      if (!response.ok) {
        console.error("Edge Function failed with status:", response.status, "Response:", responseText);
        
        // If Edge Function fails, fallback to regular API with enhanced code parameters
        console.log("Falling back to regular API for code generation...");
        return await callAI(messages, provider, apiKey, model, customModelName, false);
      }
      
      // Parse successful response
      try {
        if (!responseText || responseText.trim() === '') {
          throw new Error(`Edge Function returned empty response, falling back to regular API`);
        }
        
        const data = JSON.parse(responseText)
        
        // Validate response structure
        if (!data.response || typeof data.response !== 'string') {
          throw new Error(`Edge Function returned invalid response structure, falling back to regular API`);
        }
        
        console.log("Edge Function successful!");
        
        // Add a flag to indicate this was generated using the Edge Function
        return {
          ...data,
          codeGeneration: true,
          edgeFunction: true
        }
      } catch (parseError) {
        console.error('Edge Function JSON parse error:', parseError);
        console.error('Response text (first 500 chars):', responseText.substring(0, 500));
        
        // Fallback to regular API
        console.log("Falling back to regular API due to parse error...");
        return await callAI(messages, provider, apiKey, model, customModelName, false);
      }
    } catch (error) {
      console.error('Edge Function network error:', error);
      
      // Always fallback to regular API if Edge Function fails
      console.log("Falling back to regular API due to network error...");
      
      try {
        return await callAI(messages, provider, apiKey, model, customModelName, false);
      } catch (fallbackError) {
        // If both fail, throw the original error but with context
        throw new Error(`Code generation failed. Edge Function error: ${error instanceof Error ? error.message : 'Unknown error'}. Regular API error: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`);
      }
    }
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
  const handleSendMessage = async (message: string, attachments?: ProcessedFile[], webSearchEnabled?: boolean, codeGenerationEnabled?: boolean) => {
    if (!message.trim() && (!attachments || attachments.length === 0)) {
      return
    }

    // Ensure we have a valid conversation
    let workingConversationId = currentConversationId
    let workingConversations = conversations

    if (!workingConversationId || !workingConversations.find(c => c.id === workingConversationId)) {
      workingConversationId = `conv-${Date.now()}`
      const newConversation = {
        id: workingConversationId,
        title: message.slice(0, 30) + (message.length > 30 ? "..." : ""),
        timestamp: new Date(),
        model: currentModel,
        messages: [],
      }
      workingConversations = [newConversation, ...conversations]
      setConversations(workingConversations)
      setCurrentConversationId(workingConversationId)
    }

    // Start typing indicator
    setIsTyping(true)

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
    const updatedConversations = workingConversations.map((conv) => {
      if (conv.id === workingConversationId) {
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
      const conversationForApi = updatedConversations.find(c => c.id === workingConversationId)
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

      // Call the appropriate AI endpoint based on code generation mode or DeepSeek provider
      let apiResult;
      const shouldUseEdgeFunction = codeGenerationEnabled || selectedModelData.provider === "deepseek";
      
      if (shouldUseEdgeFunction) {
        // Use Edge Function for code generation or DeepSeek models (which are slower)
        apiResult = await callCodeGenerationAPI(allMessages, selectedModelData.provider, apiKey, modelName, customModelName)
      } else {
        // Use regular API with web search support
        apiResult = await callAI(allMessages, selectedModelData.provider, apiKey, modelName, customModelName, webSearchEnabled)
      }
      
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
        if (conv.id === workingConversationId) {
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
        if (conv.id === workingConversationId) {
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
