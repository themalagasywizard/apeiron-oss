import { supabase } from './supabase'
import { 
  User, Project, Conversation, Message,
  InsertProject, InsertConversation, InsertMessage,
  UpdateProject, UpdateConversation, UpdateMessage
} from './database.types'

// Projects
export async function getProjects(userId: string): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function createProject(project: InsertProject): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .insert(project)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateProject(id: string, updates: UpdateProject): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// Conversations
export async function getConversations(userId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function getConversationsByProject(projectId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data || null
}

export async function createConversation(conversation: InsertConversation): Promise<Conversation> {
  const { data, error } = await supabase
    .from('conversations')
    .insert(conversation)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateConversation(id: string, updates: UpdateConversation): Promise<Conversation> {
  const { data, error } = await supabase
    .from('conversations')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteConversation(id: string): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// Delete conversation with all its messages (explicit cleanup)
export async function deleteConversationWithMessages(id: string): Promise<void> {
  // First delete all messages
  const { error: messagesError } = await supabase
    .from('messages')
    .delete()
    .eq('conversation_id', id)

  if (messagesError) throw messagesError

  // Then delete the conversation
  const { error: conversationError } = await supabase
    .from('conversations')
    .delete()
    .eq('id', id)

  if (conversationError) throw conversationError
}

// Messages
export async function getMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('timestamp', { ascending: true })

  if (error) throw error
  return data || []
}

// Load conversation with all its messages
export async function getConversationWithMessages(conversationId: string): Promise<{ conversation: Conversation; messages: Message[] } | null> {
  // Get conversation
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .single()

  if (convError && convError.code !== 'PGRST116') throw convError
  if (!conversation) return null

  // Get messages
  const { data: messages, error: messagesError } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('timestamp', { ascending: true })

  if (messagesError) throw messagesError

  return {
    conversation,
    messages: messages || []
  }
}

export async function createMessage(message: InsertMessage): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert(message)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateMessage(id: string, updates: UpdateMessage): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteMessage(id: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// Utility functions for migration and sync
export async function migrateLocalDataToSupabase(userId: string) {
  try {
    // Get existing local data
    const localConversations = JSON.parse(localStorage.getItem('t3-chat-conversations') || '[]')
    
    if (localConversations.length === 0) return

    console.log('Migrating', localConversations.length, 'conversations to Supabase...')

    // Create a default project for migrated conversations
    const defaultProject = await createProject({
      user_id: userId,
      name: 'Migrated Conversations',
      description: 'Conversations migrated from local storage',
      color: '#6366f1'
    })

    // Migrate each conversation
    for (const localConv of localConversations) {
      try {
        // Create conversation
        const conversation = await createConversation({
          user_id: userId,
          project_id: defaultProject.id,
          title: localConv.title || 'Untitled Conversation',
          model: localConv.model || 'gpt-4'
        })

        // Create messages
        if (localConv.messages && Array.isArray(localConv.messages)) {
          for (const localMessage of localConv.messages) {
            await createMessage({
              conversation_id: conversation.id,
              role: localMessage.role,
              content: localMessage.content,
              model: localMessage.model || null,
              provider: localMessage.provider || null,
              attachments: localMessage.attachments || null,
              search_results: localMessage.searchResults || null,
              timestamp: localMessage.timestamp || new Date().toISOString()
            })
          }
        }
      } catch (error) {
        console.error('Error migrating conversation:', localConv.id, error)
      }
    }

    // Clear local storage after successful migration
    localStorage.removeItem('t3-chat-conversations')
    
    console.log('Migration completed successfully')
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  }
}

// Real-time subscriptions
export function subscribeToConversations(userId: string, callback: (payload: any) => void) {
  return supabase
    .channel('conversations')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'conversations',
        filter: `user_id=eq.${userId}`
      },
      callback
    )
    .subscribe()
}

export function subscribeToMessages(conversationId: string, callback: (payload: any) => void) {
  return supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      },
      callback
    )
    .subscribe()
} 