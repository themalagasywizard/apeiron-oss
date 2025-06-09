"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
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
} from "lucide-react"

// Types
type Message = {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
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

type MainUIProps = {
  conversations?: Conversation[]
  projects?: Project[]
  models?: Model[]
  currentConversation?: Conversation
  currentModel?: string
  userSettings?: UserSettings
  onSendMessage?: (message: string) => void
  onSelectConversation?: (id: string) => void
  onSelectModel?: (id: string) => void
  onCreateConversation?: () => void
  onCreateProject?: () => void
  onToggleTheme?: () => void
  onLogout?: () => void
  onSaveSettings?: (settings: any) => void
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
    grokApiKey: ""
  },
  onSendMessage = () => {},
  onSelectConversation = () => {},
  onSelectModel = () => {},
  onCreateConversation = () => {},
  onCreateProject = () => {},
  onToggleTheme = () => {},
  onLogout = () => {},
  onSaveSettings = () => {},
}: MainUIProps) {
  // Initialize default models
  const defaultModels: Model[] = [
    { id: "openai-gpt4", name: "GPT-4", icon: "G4", provider: "openai" },
    { id: "openai-gpt35", name: "GPT-3.5", icon: "G3", provider: "openai" },
    { id: "claude-3", name: "Claude 3", icon: "C3", provider: "claude" },
    { id: "gemini-2.5", name: "Gemini 2.5", icon: "G2", provider: "gemini" },
    { id: "deepseek", name: "DeepSeek", icon: "DS", provider: "deepseek" },
    { id: "grok", name: "Grok", icon: "GK", provider: "grok" },
  ]

  // State
  const [theme, setTheme] = useState<"dark" | "light">("dark")
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const [settingsTab, setSettingsTab] = useState<"general" | "models">("general")
  const [newModelProvider, setNewModelProvider] = useState<"openai" | "claude" | "gemini" | "deepseek" | "grok" | "openrouter">("openai")
  const [newModelApiKey, setNewModelApiKey] = useState("")
  const [newModelCustomName, setNewModelCustomName] = useState("")
  const [showNewModelApiKey, setShowNewModelApiKey] = useState(false)
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  // Use models from props (calculated in page.tsx with proper API key logic)
  const availableModels = models



  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLTextAreaElement>(null)

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

  // Handle sending a message
  const handleSendMessage = () => {
    if (inputValue.trim()) {
      onSendMessage(inputValue)
      setInputValue("")
      // Simulate AI typing
      setIsTyping(true)
      setTimeout(() => {
        setIsTyping(false)
      }, 2000)
    }
  }

  // Handle key press in input
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Toggle project expansion
  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }))
  }

  // Add new model (save API keys directly to userSettings)
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

    // Save API keys directly to userSettings based on provider
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
    }

    onSaveSettings(updatedSettings)

    // Reset form
    setNewModelApiKey("")
    setNewModelCustomName("")
    setNewModelProvider("openai")
  }

  // Remove model (clear API keys)
  const handleRemoveModel = (modelId: string) => {
    let updatedSettings = { ...userSettings }
    
    // If it's a default model, clear the API key
    if (modelId === "deepseek") {
      updatedSettings.deepseekApiKey = ""
    } else if (modelId === "openai-gpt4" || modelId === "openai-gpt35") {
      updatedSettings.openaiApiKey = ""
    } else if (modelId === "claude-3") {
      updatedSettings.claudeApiKey = ""
    } else if (modelId === "gemini-2.5") {
      updatedSettings.geminiApiKey = ""
    } else if (modelId === "grok") {
      updatedSettings.grokApiKey = ""
    } else {
      // Custom model - remove from models array
      updatedSettings.models = userSettings.models.filter(m => m.id !== modelId)
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

  return (
    <div
      className={`font-inter h-screen flex flex-col ${theme === "dark" ? "dark bg-gradient-to-br from-gray-900 to-gray-800" : "bg-gradient-to-br from-gray-50 to-white"}`}
    >
      {/* Top Bar */}
      <header className="h-16 px-4 flex items-center justify-between border-b backdrop-blur-lg bg-white/10 dark:bg-gray-900/30 sticky top-0 z-10">
        {isMobile && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-full hover:bg-gray-200/20 dark:hover:bg-gray-700/20 transition-colors"
            aria-label="Open sidebar"
          >
            <Menu className="w-6 h-6 text-gray-700 dark:text-gray-200" />
          </button>
        )}

        <div className="flex-1 flex justify-center md:justify-start">
          {!isMobile && (
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
              AI Chat
            </h1>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-gray-200/20 dark:hover:bg-gray-700/20 transition-colors"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun className="w-5 h-5 text-gray-200" /> : <Moon className="w-5 h-5 text-gray-700" />}
          </button>

          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white font-medium">
            U
          </div>

          <button
            onClick={onLogout}
            className="p-2 rounded-full hover:bg-gray-200/20 dark:hover:bg-gray-700/20 transition-colors md:ml-2"
            aria-label="Log out"
          >
            <LogOut className="w-5 h-5 text-gray-700 dark:text-gray-200" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
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
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200/20 dark:border-gray-700/20 h-[60px]">
                <div></div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 rounded-full hover:bg-gray-200/20 dark:hover:bg-gray-700/20 transition-colors"
                  aria-label="Close sidebar"
                >
                  <X className="w-5 h-5 text-gray-700 dark:text-gray-200" />
                </button>
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
                      <button
                        key={conversation.id}
                        onClick={() => onSelectConversation(conversation.id)}
                        className={`
                          w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200
                          hover:bg-white/20 dark:hover:bg-gray-800/40
                          ${
                            currentConversation.id === conversation.id
                              ? "bg-white/30 dark:bg-gray-800/60 shadow-sm"
                              : "bg-transparent"
                          }
                        `}
                      >
                        <div className="font-medium text-gray-800 dark:text-gray-200 truncate">
                          {conversation.title}
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(conversation.timestamp).toLocaleDateString()}
                          </span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200/50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300">
                            {availableModels.find((m) => m.id === conversation.model)?.name || conversation.model}
                          </span>
                        </div>
                      </button>
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
                                <button
                                  key={conv.id}
                                  onClick={() => onSelectConversation(conv.id)}
                                  className={`
                                    w-full text-left px-3 py-1.5 rounded-lg text-xs transition-all duration-200
                                    hover:bg-white/20 dark:hover:bg-gray-800/40
                                    ${
                                      currentConversation.id === conv.id
                                        ? "bg-white/30 dark:bg-gray-800/60 shadow-sm"
                                        : "bg-transparent"
                                    }
                                  `}
                                >
                                  <div className="font-medium text-gray-800 dark:text-gray-200 truncate">
                                    {conv.title}
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Settings Button */}
              <div className="px-4 py-3 border-t border-gray-200/20 dark:border-gray-700/20 h-[72px] flex items-center">
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="w-full h-[48px] flex items-center justify-center gap-2 rounded-xl bg-white/20 dark:bg-gray-800/40 hover:bg-white/30 dark:hover:bg-gray-800/60 transition-colors text-gray-800 dark:text-gray-200"
                  aria-label="Open settings"
                >
                  <Settings className="w-4 h-4" />
                  <span>Settings</span>
                </button>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main Chat Panel */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Chat Header */}
          <div className="px-4 py-3 border-b backdrop-blur-lg bg-white/10 dark:bg-gray-900/30 flex items-center justify-between h-[60px]">
            <div className="flex items-center">
              {!isMobile && !sidebarOpen && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-2 mr-2 rounded-full hover:bg-gray-200/20 dark:hover:bg-gray-700/20 transition-colors"
                  aria-label="Open sidebar"
                >
                  <Menu className="w-5 h-5 text-gray-700 dark:text-gray-200" />
                </button>
              )}

              <h2 className="font-medium text-gray-800 dark:text-gray-200">{currentConversation.title}</h2>

              <div className="ml-3 px-2 py-1 text-xs rounded-full bg-gray-200/50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300">
                {availableModels.find((m) => m.id === currentConversation.model)?.name || currentConversation.model}
              </div>
            </div>
          </div>

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
                  <div className="prose dark:prose-invert prose-sm">{message.content}</div>
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

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white/20 dark:bg-gray-800/40 rounded-2xl p-4 border border-gray-200/20 dark:border-gray-700/20">
                  <div className="flex space-x-2">
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
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="px-4 py-3 border-t border-gray-200/20 dark:border-gray-700/20 backdrop-blur-lg bg-white/10 dark:bg-gray-900/30 h-[72px] flex items-center">
            <div className="flex items-center gap-3 w-full">
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
                disabled={!inputValue.trim()}
                className={`
                  h-[48px] w-[48px] rounded-xl flex-shrink-0 transition-all duration-200 flex items-center justify-center
                  ${
                    inputValue.trim()
                      ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg hover:shadow-purple-500/25"
                      : "bg-gray-200/50 dark:bg-gray-700/50 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                  }
                `}
                aria-label="Send message"
              >
                <Send className="w-5 h-5" />
              </button>

              <button
                disabled={true}
                className="h-[48px] w-[48px] rounded-xl bg-gray-200/50 dark:bg-gray-700/50 text-gray-400 dark:text-gray-500 cursor-not-allowed flex-shrink-0 flex items-center justify-center"
                aria-label="Voice input (coming soon)"
              >
                <Mic className="w-5 h-5" />
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
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
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
                                <option value="gemini">Google (Gemini)</option>
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
                          <div className="space-y-2">
                            {(() => {
                              // Get list of configured models based on API keys
                              const configuredModels = []
                              
                              if (userSettings.deepseekApiKey) {
                                configuredModels.push({ id: "deepseek", name: "DeepSeek", icon: "DS", provider: "deepseek" })
                              }
                              if (userSettings.openaiApiKey) {
                                configuredModels.push({ id: "openai-gpt4", name: "GPT-4", icon: "G4", provider: "openai" })
                              }
                              if (userSettings.claudeApiKey) {
                                configuredModels.push({ id: "claude-3", name: "Claude 3", icon: "C3", provider: "claude" })
                              }
                              if (userSettings.geminiApiKey) {
                                configuredModels.push({ id: "gemini-2.5", name: "Gemini 2.5", icon: "G2", provider: "gemini" })
                              }
                              if (userSettings.grokApiKey) {
                                configuredModels.push({ id: "grok", name: "Grok", icon: "GK", provider: "grok" })
                              }
                              
                              // Add custom models
                              configuredModels.push(...userSettings.models)
                              
                              return configuredModels.length === 0 ? (
                                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                                  No models configured yet. Add your first model above.
                                </p>
                              ) : (
                                configuredModels.map((model) => (
                                  <div
                                    key={model.id}
                                    className="flex items-center justify-between p-3 bg-white/50 dark:bg-gray-900/50 rounded-lg border border-gray-200/50 dark:border-gray-700/50"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center text-white text-xs font-bold">
                                        {model.icon}
                                      </div>
                                      <div>
                                        <div className="font-medium text-gray-900 dark:text-gray-100">{model.name}</div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400 capitalize">{model.provider}</div>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => handleRemoveModel(model.id)}
                                      className="text-red-500 hover:text-red-600 transition-colors"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
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
