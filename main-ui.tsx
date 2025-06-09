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
}

type MainUIProps = {
  conversations?: Conversation[]
  projects?: Project[]
  models?: Model[]
  currentConversation?: Conversation
  currentModel?: string
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
  models = [
    { id: "gpt-4", name: "GPT-4", icon: "G4" },
    { id: "claude", name: "Claude", icon: "C" },
    { id: "gemini", name: "Gemini", icon: "GM" },
  ],
  currentConversation = {
    id: "default",
    title: "New Conversation",
    timestamp: new Date(),
    model: "gpt-4",
    messages: [],
  },
  currentModel = "gpt-4",
  onSendMessage = () => {},
  onSelectConversation = () => {},
  onSelectModel = () => {},
  onCreateConversation = () => {},
  onCreateProject = () => {},
  onToggleTheme = () => {},
  onLogout = () => {},
  onSaveSettings = () => {},
}: MainUIProps) {
  // State
  const [theme, setTheme] = useState<"dark" | "light">("dark")
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [apiKey, setApiKey] = useState("")
  const [showApiKey, setShowApiKey] = useState(false)
  const [temperature, setTemperature] = useState(0.7)
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)

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

  // Save settings
  const handleSaveSettings = () => {
    onSaveSettings({ apiKey, temperature, theme })
    setSettingsOpen(false)
    // Simulate error for demonstration
    if (apiKey === "invalid") {
      setError("Invalid API key. Please check and try again.")
      setTimeout(() => setError(null), 5000)
    }
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
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200/20 dark:border-gray-700/20">
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
                            {models.find((m) => m.id === conversation.model)?.name || conversation.model}
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
              <div className="p-4 border-t border-gray-200/20 dark:border-gray-700/20">
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="w-full flex items-center justify-center gap-2 p-2 rounded-lg bg-white/20 dark:bg-gray-800/40 hover:bg-white/30 dark:hover:bg-gray-800/60 transition-colors text-gray-800 dark:text-gray-200"
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
          <div className="px-4 py-3 border-b backdrop-blur-lg bg-white/10 dark:bg-gray-900/30 flex items-center justify-between">
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
                {models.find((m) => m.id === currentConversation.model)?.name || currentConversation.model}
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
          <div className="px-4 py-3 border-t border-gray-200/20 dark:border-gray-700/20 backdrop-blur-lg bg-white/10 dark:bg-gray-900/30">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <div className="relative">
                  <select
                    value={currentModel}
                    onChange={(e) => onSelectModel(e.target.value)}
                    className="h-[48px] w-36 px-3 pr-8 rounded-xl bg-white/20 dark:bg-gray-800/40 backdrop-blur-lg border border-gray-200/20 dark:border-gray-700/20 text-gray-800 dark:text-gray-200 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    aria-label="Select AI model"
                  >
                    {models.map((model) => (
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
              className="w-full max-w-md bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-gray-200/20 dark:border-gray-700/20">
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">Settings</h3>
              </div>

              <div className="p-5 space-y-6">
                {/* API Key */}
                <div className="space-y-2">
                  <label htmlFor="api-key" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    API Key
                  </label>
                  <div className="relative">
                    <input
                      id="api-key"
                      type={showApiKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="w-full p-2 pr-10 rounded-lg bg-white/50 dark:bg-gray-900/50 border border-gray-200/50 dark:border-gray-700/50 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                      placeholder="Enter your API key"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                      aria-label={showApiKey ? "Hide API key" : "Show API key"}
                    >
                      {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Your API key is stored locally and never sent to our servers.
                  </p>
                </div>

                {/* Temperature */}
                <div className="space-y-2">
                  <label htmlFor="temperature" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Temperature: {temperature.toFixed(1)}
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Deterministic</span>
                    <input
                      id="temperature"
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={temperature}
                      onChange={(e) => setTemperature(Number.parseFloat(e.target.value))}
                      className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500"
                    />
                    <span className="text-xs text-gray-500 dark:text-gray-400">Creative</span>
                  </div>
                </div>

                {/* Theme */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Theme</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTheme("light")}
                      className={`
                        flex-1 p-3 rounded-lg border transition-all duration-200
                        ${
                          theme === "light"
                            ? "border-purple-500 bg-purple-500/10 text-purple-700 dark:text-purple-300"
                            : "border-gray-200/50 dark:border-gray-700/50 bg-white/50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-300"
                        }
                      `}
                    >
                      Light
                    </button>
                    <button
                      onClick={() => setTheme("dark")}
                      className={`
                        flex-1 p-3 rounded-lg border transition-all duration-200
                        ${
                          theme === "dark"
                            ? "border-purple-500 bg-purple-500/10 text-purple-700 dark:text-purple-300"
                            : "border-gray-200/50 dark:border-gray-700/50 bg-white/50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-300"
                        }
                      `}
                    >
                      Dark
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-5 border-t border-gray-200/20 dark:border-gray-700/20 flex justify-end gap-3">
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="px-4 py-2 rounded-lg border border-gray-200/50 dark:border-gray-700/50 text-gray-700 dark:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSettings}
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
