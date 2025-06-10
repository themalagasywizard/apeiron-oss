"use client"

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { 
  Plus, 
  FolderPlus, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  MessageSquare,
  Clock,
  FolderOpen
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Project, Conversation } from '@/lib/database.types'

interface ProjectSidebarProps {
  projects: Project[]
  conversations: Conversation[]
  selectedProjectId?: string | null
  selectedConversationId?: string
  onCreateProject: (name: string, description?: string) => void
  onSelectProject: (projectId: string | null) => void
  onSelectConversation: (conversationId: string) => void
  onUpdateProject: (id: string, updates: { name?: string; description?: string; color?: string }) => void
  onDeleteProject: (id: string) => void
  onMoveConversation: (conversationId: string, projectId: string | null) => void
  onCreateConversation: () => void
}

const PROJECT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899'
]

export function ProjectSidebar({
  projects,
  conversations,
  selectedProjectId,
  selectedConversationId,
  onCreateProject,
  onSelectProject,
  onSelectConversation,
  onUpdateProject,
  onDeleteProject,
  onMoveConversation,
  onCreateConversation
}: ProjectSidebarProps) {
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [editingProject, setEditingProject] = useState<string | null>(null)
  const [editProjectName, setEditProjectName] = useState('')
  const [draggedConversation, setDraggedConversation] = useState<string | null>(null)
  const [dragOverProject, setDragOverProject] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleCreateProject = () => {
    if (newProjectName.trim()) {
      onCreateProject(newProjectName.trim())
      setNewProjectName('')
      setIsCreatingProject(false)
    }
  }

  const handleUpdateProject = (projectId: string) => {
    if (editProjectName.trim()) {
      onUpdateProject(projectId, { name: editProjectName.trim() })
      setEditingProject(null)
      setEditProjectName('')
    }
  }

  const handleDragStart = (e: React.DragEvent, conversationId: string) => {
    setDraggedConversation(conversationId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, projectId: string | null) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverProject(projectId)
  }

  const handleDragLeave = () => {
    setDragOverProject(null)
  }

  const handleDrop = (e: React.DragEvent, projectId: string | null) => {
    e.preventDefault()
    if (draggedConversation) {
      onMoveConversation(draggedConversation, projectId)
    }
    setDraggedConversation(null)
    setDragOverProject(null)
  }

  const getConversationsForProject = (projectId: string | null) => {
    return conversations.filter(conv => conv.project_id === projectId)
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInMs = now.getTime() - date.getTime()
    const diffInHours = diffInMs / (1000 * 60 * 60)
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString([], { weekday: 'short' })
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }
  }

  return (
    <div className="w-80 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Projects</h2>
          <Button
            onClick={() => setIsCreatingProject(true)}
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
          >
            <FolderPlus className="w-4 h-4" />
          </Button>
        </div>

        {isCreatingProject && (
          <div className="space-y-2">
            <Input
              placeholder="Project name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateProject()
                if (e.key === 'Escape') {
                  setIsCreatingProject(false)
                  setNewProjectName('')
                }
              }}
              autoFocus
            />
            <div className="flex gap-2">
              <Button onClick={handleCreateProject} size="sm">
                Create
              </Button>
              <Button
                onClick={() => {
                  setIsCreatingProject(false)
                  setNewProjectName('')
                }}
                size="sm"
                variant="ghost"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {/* Unorganized Conversations */}
          <div
            className={cn(
              "rounded-lg border-2 border-dashed transition-colors",
              dragOverProject === null && draggedConversation
                ? "border-blue-400 bg-blue-50 dark:bg-blue-950"
                : "border-gray-300 dark:border-gray-600"
            )}
            onDragOver={(e) => handleDragOver(e, null)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, null)}
          >
            <div
              className={cn(
                "p-3 cursor-pointer rounded-lg transition-colors",
                selectedProjectId === null
                  ? "bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100"
                  : "hover:bg-gray-100 dark:hover:bg-gray-800"
              )}
              onClick={() => onSelectProject(null)}
            >
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4" />
                <span className="font-medium">Unorganized</span>
                <span className="text-xs text-gray-500">
                  ({getConversationsForProject(null).length})
                </span>
              </div>
            </div>

            {selectedProjectId === null && (
              <div className="space-y-1 px-3 pb-3">
                {getConversationsForProject(null).map((conversation) => (
                  <div
                    key={conversation.id}
                    className={cn(
                      "p-2 rounded cursor-pointer text-sm transition-colors",
                      selectedConversationId === conversation.id
                        ? "bg-blue-200 dark:bg-blue-800"
                        : "hover:bg-gray-200 dark:hover:bg-gray-700"
                    )}
                    draggable
                    onDragStart={(e) => handleDragStart(e, conversation.id)}
                    onClick={() => onSelectConversation(conversation.id)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">{conversation.title}</span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTimestamp(conversation.updated_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Projects */}
          {projects.map((project) => (
            <div
              key={project.id}
              className={cn(
                "rounded-lg border-2 border-dashed transition-colors",
                dragOverProject === project.id && draggedConversation
                  ? "border-blue-400 bg-blue-50 dark:bg-blue-950"
                  : "border-transparent"
              )}
              onDragOver={(e) => handleDragOver(e, project.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, project.id)}
            >
              <div
                className={cn(
                  "p-3 cursor-pointer rounded-lg transition-colors border",
                  selectedProjectId === project.id
                    ? "bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 border-blue-200 dark:border-blue-700"
                    : "hover:bg-gray-100 dark:hover:bg-gray-800 border-gray-200 dark:border-gray-700"
                )}
                onClick={() => onSelectProject(project.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: project.color || '#6366f1' }}
                    />
                    {editingProject === project.id ? (
                      <Input
                        value={editProjectName}
                        onChange={(e) => setEditProjectName(e.target.value)}
                        onKeyDown={(e) => {
                          e.stopPropagation()
                          if (e.key === 'Enter') handleUpdateProject(project.id)
                          if (e.key === 'Escape') {
                            setEditingProject(null)
                            setEditProjectName('')
                          }
                        }}
                        onBlur={() => handleUpdateProject(project.id)}
                        className="h-6 text-sm"
                        autoFocus
                      />
                    ) : (
                      <span className="font-medium">{project.name}</span>
                    )}
                    <span className="text-xs text-gray-500">
                      ({getConversationsForProject(project.id).length})
                    </span>
                  </div>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48" align="end">
                      <div className="space-y-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start"
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingProject(project.id)
                            setEditProjectName(project.name)
                          }}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Rename
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-red-600 hover:text-red-700"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDeleteProject(project.id)
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {project.description && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                    {project.description}
                  </p>
                )}
              </div>

              {selectedProjectId === project.id && (
                <div className="space-y-1 px-3 pb-3">
                  {getConversationsForProject(project.id).map((conversation) => (
                    <div
                      key={conversation.id}
                      className={cn(
                        "p-2 rounded cursor-pointer text-sm transition-colors",
                        selectedConversationId === conversation.id
                          ? "bg-blue-200 dark:bg-blue-800"
                          : "hover:bg-gray-200 dark:hover:bg-gray-700"
                      )}
                      draggable
                      onDragStart={(e) => handleDragStart(e, conversation.id)}
                      onClick={() => onSelectConversation(conversation.id)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate">{conversation.title}</span>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTimestamp(conversation.updated_at)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <Button
          onClick={onCreateConversation}
          className="w-full"
          variant="outline"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Conversation
        </Button>
      </div>
    </div>
  )
} 