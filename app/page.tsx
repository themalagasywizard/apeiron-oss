"use client"

import { useState } from "react"
import MainUI from "@/main-ui"

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
        role: "user",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
      },
      {
        id: "msg2",
        content:
          "Quantum computing uses quantum bits or 'qubits' that can exist in multiple states at once, unlike classical bits that are either 0 or 1. This allows quantum computers to process certain types of problems much faster than traditional computers. Think of it like being able to try many solutions simultaneously instead of one at a time.",
        role: "assistant",
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
        role: "user",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
      },
      {
        id: "msg4",
        content:
          "The main ethical concerns with advanced AI include:\n\n1. **Privacy and surveillance** - AI systems can process vast amounts of personal data\n2. **Bias and fairness** - AI can perpetuate or amplify existing biases\n3. **Autonomy and decision-making** - Questions about AI making important decisions\n4. **Job displacement** - Automation potentially replacing human workers\n5. **Security risks** - Potential for misuse or unintended consequences\n6. **Accountability** - Determining responsibility when AI systems cause harm",
        role: "assistant",
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
        role: "user",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72),
      },
      {
        id: "msg6",
        content:
          "Here are some beginner-friendly machine learning project ideas:\n\n1. **Image classification** - Build a model to identify objects in images\n2. **Sentiment analysis** - Analyze text to determine emotional tone\n3. **Price prediction** - Create a model to predict house or product prices\n4. **Music genre classifier** - Identify music genres from audio samples\n5. **Recommendation system** - Build a simple movie or book recommender\n\nStart with well-documented datasets like MNIST for handwritten digits or IMDb reviews for sentiment analysis.",
        role: "assistant",
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
  const [conversations, setConversations] = useState(sampleConversations)
  const [currentConversationId, setCurrentConversationId] = useState("conv1")
  const [currentModel, setCurrentModel] = useState("gpt-4")

  // Find current conversation
  const currentConversation = conversations.find((conv) => conv.id === currentConversationId) || conversations[0]

  // Handle sending a message
  const handleSendMessage = (message: string) => {
    const newUserMessage = {
      id: `msg-${Date.now()}-user`,
      content: message,
      role: "user" as const,
      timestamp: new Date(),
    }

    // Add user message
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

    // Simulate AI response after a delay
    setTimeout(() => {
      const aiResponses = [
        "I understand your question. Let me think about that for a moment...\n\nBased on the information available, there are several approaches we could take. The most effective would likely involve analyzing the underlying patterns and identifying key factors that contribute to the outcome.",
        "That's an interesting point! When we consider this topic, it's important to look at it from multiple perspectives.\n\n1. **Historical context** - How this has evolved over time\n2. **Current applications** - Where we see this being used today\n3. **Future implications** - Potential developments on the horizon\n\nWould you like me to elaborate on any of these aspects?",
        "Great question! This is a complex topic with several important considerations:\n\n```python\n# Example code demonstrating the concept\ndef analyze_data(input_data):\n    results = process(input_data)\n    return results.summary()\n```\n\nThe above pattern shows how we might approach this programmatically. Does this help clarify things?",
      ]

      const randomResponse = aiResponses[Math.floor(Math.random() * aiResponses.length)]

      const newAiMessage = {
        id: `msg-${Date.now()}-ai`,
        content: randomResponse,
        role: "assistant" as const,
        timestamp: new Date(),
      }

      const finalConversations = conversations.map((conv) => {
        if (conv.id === currentConversationId) {
          return {
            ...conv,
            messages: [...conv.messages, newUserMessage, newAiMessage],
          }
        }
        return conv
      })

      setConversations(finalConversations)
    }, 2000)
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

  return (
    <MainUI
      conversations={conversations}
      projects={sampleProjects}
      currentConversation={currentConversation}
      currentModel={currentModel}
      onSendMessage={handleSendMessage}
      onSelectConversation={setCurrentConversationId}
      onSelectModel={setCurrentModel}
      onCreateConversation={handleCreateConversation}
    />
  )
}
