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
  provider: "openai" | "claude" | "gemini" | "deepseek" | "grok" | "openrouter"
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
}

// Sample data for demonstration
const sampleConversations = [
  {
    id: "conv1",
    title: "Understanding Quantum Computing",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    model: "gpt-4",
    messages: [
      {
        id: "msg1",
        content: "Can you explain quantum computing in simple terms?",
        role: "user" as const,
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
      },
      {
        id: "msg2",
        content:
          "Quantum computing uses quantum bits or 'qubits' that can exist in multiple states at once, unlike classical bits that are either 0 or 1. This allows quantum computers to process certain types of problems much faster than traditional computers. Think of it like being able to try many solutions simultaneously instead of one at a time.",
        role: "assistant" as const,
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2 + 30000),
      },
    ],
  },
  {
    id: "conv2",
    title: "AI Ethics Discussion",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    model: "claude",
    messages: [
      {
        id: "msg3",
        content: "What are the main ethical concerns with advanced AI?",
        role: "user" as const,
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
      },
      {
        id: "msg4",
        content:
          "The main ethical concerns with advanced AI include:\n\n1. **Privacy and surveillance** - AI systems can process vast amounts of personal data\n2. **Bias and fairness** - AI can perpetuate or amplify existing biases\n3. **Autonomy and decision-making** - Questions about AI making important decisions\n4. **Job displacement** - Automation potentially replacing human workers\n5. **Security risks** - Potential for misuse or unintended consequences\n6. **Accountability** - Determining responsibility when AI systems cause harm",
        role: "assistant" as const,
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 + 45000),
      },
    ],
  },
  {
    id: "conv3",
    title: "Machine Learning Project Ideas",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72), // 3 days ago
    model: "gemini",
    messages: [
      {
        id: "msg5",
        content: "I'm learning ML. What are some beginner-friendly project ideas?",
        role: "user" as const,
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72),
      },
      {
        id: "msg6",
        content:
          "Here are some beginner-friendly machine learning project ideas:\n\n1. **Image classification** - Build a model to identify objects in images\n2. **Sentiment analysis** - Analyze text to determine emotional tone\n3. **Price prediction** - Create a model to predict house or product prices\n4. **Music genre classifier** - Identify music genres from audio samples\n5. **Recommendation system** - Build a simple movie or book recommender\n\nStart with well-documented datasets like MNIST for handwritten digits or IMDb reviews for sentiment analysis.",
        role: "assistant" as const,
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72 + 60000),
      },
    ],
  },
]

const sampleProjects = [
  {
    id: "proj1",
    name: "Research Papers",
    conversations: ["conv1"],
  },
  {
    id: "proj2",
    name: "Personal Projects",
    conversations: ["conv2", "conv3"],
  },
]

export default function Home() {
  const [isClient, setIsClient] = useState(false)
  const [conversations, setConversations] = useState(sampleConversations)
  const [currentConversationId, setCurrentConversationId] = useState("conv1")
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
    grokApiKey: ""
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
            grokApiKey: parsed.grokApiKey || ""
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
        grokApiKey: ""
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
    { id: "grok", name: "Grok", icon: "GK", provider: "grok" }
  ]

  // Get available models (user configured + defaults without API keys)
  const availableModels = userSettings.openrouterEnabled 
    ? [{ id: "openrouter", name: userSettings.openrouterModelName || "OpenRouter", icon: "OR", provider: "openrouter" as const }]
    : [...userSettings.models, ...defaultModels.filter(m => !userSettings.models.some(um => um.id === m.id))]

  // API calling functions
  const callOpenAI = async (messages: Message[], apiKey: string, model: string = "gpt-4") => {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model.includes("gpt-3.5") ? "gpt-3.5-turbo" : "gpt-4",
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        temperature: userSettings.temperature,
        stream: false
      })
    })
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`)
    }
    
    const data = await response.json()
    return data.choices[0]?.message?.content || "No response"
  }

  const callClaude = async (messages: Message[], apiKey: string) => {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-opus-20240229",
        max_tokens: 4000,
        temperature: userSettings.temperature,
        messages: messages.map(m => ({ role: m.role, content: m.content }))
      })
    })
    
    if (!response.ok) {
      throw new Error(`Claude API error: ${response.statusText}`)
    }
    
    const data = await response.json()
    return data.content[0]?.text || "No response"
  }

  const callGemini = async (messages: Message[], apiKey: string) => {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: messages.map(m => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }]
        })),
        generationConfig: {
          temperature: userSettings.temperature,
          maxOutputTokens: 4000
        }
      })
    })
    
    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`)
    }
    
    const data = await response.json()
    return data.candidates[0]?.content?.parts[0]?.text || "No response"
  }

  const callDeepSeek = async (messages: Message[], apiKey: string) => {
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        temperature: userSettings.temperature,
        stream: false
      })
    })
    
    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.statusText}`)
    }
    
    const data = await response.json()
    return data.choices[0]?.message?.content || "No response"
  }

  const callGrok = async (messages: Message[], apiKey: string) => {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "grok-beta",
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        temperature: userSettings.temperature,
        stream: false
      })
    })
    
    if (!response.ok) {
      throw new Error(`Grok API error: ${response.statusText}`)
    }
    
    const data = await response.json()
    return data.choices[0]?.message?.content || "No response"
  }

  const callOpenRouter = async (messages: Message[], apiKey: string, modelName: string) => {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "",
        "X-Title": "T3 Chat"
      },
      body: JSON.stringify({
        model: modelName,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        temperature: userSettings.temperature,
        stream: false
      })
    })
    
    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.statusText}`)
    }
    
    const data = await response.json()
    return data.choices[0]?.message?.content || "No response"
  }

  // Find current conversation
  const currentConversation = conversations.find((conv) => conv.id === currentConversationId) || conversations[0]

  // Handle sending a message
  const handleSendMessage = async (message: string, attachments?: ProcessedFile[]) => {
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
      switch (selectedModelData.provider) {
        case "openai":
          const openaiKey = userSettings.openaiApiKey || ""
          if (!openaiKey) {
            throw new Error("OpenAI API key not configured. Please add it in Settings > Models.")
          }
          aiResponse = await callOpenAI(allMessages, openaiKey, selectedModelData.id)
          break

        case "claude":
          const claudeKey = userSettings.claudeApiKey || ""
          if (!claudeKey) {
            throw new Error("Claude API key not configured. Please add it in Settings > Models.")
          }
          aiResponse = await callClaude(allMessages, claudeKey)
          break

        case "gemini":
          const geminiKey = userSettings.geminiApiKey || ""
          if (!geminiKey) {
            throw new Error("Gemini API key not configured. Please add it in Settings > Models.")
          }
          aiResponse = await callGemini(allMessages, geminiKey)
          break

        case "deepseek":
          const deepseekKey = userSettings.deepseekApiKey || ""
          if (!deepseekKey) {
            throw new Error("DeepSeek API key not configured. Please add it in Settings > Models.")
          }
          aiResponse = await callDeepSeek(allMessages, deepseekKey)
          break

        case "grok":
          const grokKey = userSettings.grokApiKey || ""
          if (!grokKey) {
            throw new Error("Grok API key not configured. Please add it in Settings > Models.")
          }
          aiResponse = await callGrok(allMessages, grokKey)
          break

        case "openrouter":
          const openrouterKey = userSettings.openrouterApiKey || ""
          const openrouterModel = userSettings.openrouterModelName || "meta-llama/llama-3.1-8b-instruct:free"
          if (!openrouterKey) {
            throw new Error("OpenRouter API key not configured. Please add it in Settings > Models.")
          }
          aiResponse = await callOpenRouter(allMessages, openrouterKey, openrouterModel)
          break

        default:
          throw new Error(`API key required. Please configure ${selectedModelData.provider} in Settings > Models.`)
      }

      // 5. Add the AI response message
      const newAiMessage = {
        id: `msg-${Date.now()}-ai`,
        content: aiResponse,
        role: "assistant" as const,
        timestamp: new Date(),
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
        content: `Error: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
        role: "assistant" as const,
        timestamp: new Date(),
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
      projects={sampleProjects}
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
    />
  )
}
