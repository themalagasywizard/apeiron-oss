import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

// Types for HTML code storage
export interface HTMLCodeEntry {
  id: string
  title: string
  description?: string
  htmlContent: string
  createdAt: string
  updatedAt: string
  userId?: string
  isPublic: boolean
  tags: string[]
  templateType?: 'basic' | 'header' | 'navigation' | 'alert' | 'complete'
  downloadCount: number
}

// In-memory storage for development (replace with PostgreSQL in production)
let htmlCodeStorage: HTMLCodeEntry[] = []

// Simulate PostgreSQL operations for development
class PostgreSQLSimulator {
  static async create(data: Omit<HTMLCodeEntry, 'id' | 'createdAt' | 'updatedAt' | 'downloadCount'>): Promise<HTMLCodeEntry> {
    const entry: HTMLCodeEntry = {
      ...data,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      downloadCount: 0
    }
    
    htmlCodeStorage.push(entry)
    return entry
  }

  static async findById(id: string): Promise<HTMLCodeEntry | null> {
    return htmlCodeStorage.find(entry => entry.id === id) || null
  }

  static async findMany(options: {
    userId?: string
    isPublic?: boolean
    templateType?: string
    tags?: string[]
    limit?: number
    offset?: number
  } = {}): Promise<HTMLCodeEntry[]> {
    let filtered = htmlCodeStorage

    if (options.userId) {
      filtered = filtered.filter(entry => entry.userId === options.userId)
    }

    if (options.isPublic !== undefined) {
      filtered = filtered.filter(entry => entry.isPublic === options.isPublic)
    }

    if (options.templateType) {
      filtered = filtered.filter(entry => entry.templateType === options.templateType)
    }

    if (options.tags && options.tags.length > 0) {
      filtered = filtered.filter(entry => 
        options.tags!.some(tag => entry.tags.includes(tag))
      )
    }

    // Sort by creation date (newest first)
    filtered = filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    // Apply pagination
    const offset = options.offset || 0
    const limit = options.limit || 50
    return filtered.slice(offset, offset + limit)
  }

  static async update(id: string, data: Partial<HTMLCodeEntry>): Promise<HTMLCodeEntry | null> {
    const index = htmlCodeStorage.findIndex(entry => entry.id === id)
    if (index === -1) return null

    htmlCodeStorage[index] = {
      ...htmlCodeStorage[index],
      ...data,
      updatedAt: new Date().toISOString()
    }

    return htmlCodeStorage[index]
  }

  static async delete(id: string): Promise<boolean> {
    const index = htmlCodeStorage.findIndex(entry => entry.id === id)
    if (index === -1) return false

    htmlCodeStorage.splice(index, 1)
    return true
  }

  static async incrementDownloadCount(id: string): Promise<void> {
    const entry = await this.findById(id)
    if (entry) {
      entry.downloadCount += 1
      entry.updatedAt = new Date().toISOString()
    }
  }
}

// Production PostgreSQL implementation (for Netlify deployment)
class PostgreSQLProduction {
  private static connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL

  static async executeQuery(query: string, params: any[] = []): Promise<any> {
    // This would use a PostgreSQL client like 'pg' or '@vercel/postgres'
    // For Netlify, you might use '@neondatabase/serverless' or similar
    
    if (!this.connectionString) {
      throw new Error('Database connection string not found')
    }

    // Implementation would go here
    console.log('PostgreSQL Query:', query, params)
    throw new Error('PostgreSQL implementation not yet configured')
  }

  static async create(data: Omit<HTMLCodeEntry, 'id' | 'createdAt' | 'updatedAt' | 'downloadCount'>): Promise<HTMLCodeEntry> {
    const id = uuidv4()
    const now = new Date().toISOString()
    
    const query = `
      INSERT INTO html_codes (id, title, description, html_content, user_id, is_public, tags, template_type, created_at, updated_at, download_count)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0)
      RETURNING *
    `
    
    const params = [
      id,
      data.title,
      data.description || null,
      data.htmlContent,
      data.userId || null,
      data.isPublic,
      JSON.stringify(data.tags),
      data.templateType || null,
      now,
      now
    ]

    const result = await this.executeQuery(query, params)
    return this.mapRowToEntry(result.rows[0])
  }

  static async findById(id: string): Promise<HTMLCodeEntry | null> {
    const query = 'SELECT * FROM html_codes WHERE id = $1'
    const result = await this.executeQuery(query, [id])
    
    if (result.rows.length === 0) return null
    return this.mapRowToEntry(result.rows[0])
  }

  private static mapRowToEntry(row: any): HTMLCodeEntry {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      htmlContent: row.html_content,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      userId: row.user_id,
      isPublic: row.is_public,
      tags: JSON.parse(row.tags || '[]'),
      templateType: row.template_type,
      downloadCount: row.download_count || 0
    }
  }

  static async findMany(options: {
    userId?: string
    isPublic?: boolean
    templateType?: string
    tags?: string[]
    limit?: number
    offset?: number
  } = {}): Promise<HTMLCodeEntry[]> {
    // Implementation would build SQL query based on options
    throw new Error('PostgreSQL findMany implementation not yet configured')
  }

  static async update(id: string, data: Partial<HTMLCodeEntry>): Promise<HTMLCodeEntry | null> {
    // Implementation would update the record
    throw new Error('PostgreSQL update implementation not yet configured')
  }

  static async delete(id: string): Promise<boolean> {
    // Implementation would delete the record
    throw new Error('PostgreSQL delete implementation not yet configured')
  }

  static async incrementDownloadCount(id: string): Promise<void> {
    // Implementation would increment download count
    throw new Error('PostgreSQL incrementDownloadCount implementation not yet configured')
  }
}

// Choose database implementation based on environment
const db = process.env.NODE_ENV === 'production' ? PostgreSQLProduction : PostgreSQLSimulator

// API Handlers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (id) {
      // Get specific HTML code entry
      const entry = await db.findById(id)
      if (!entry) {
        return NextResponse.json(
          { error: 'HTML code not found' },
          { status: 404 }
        )
      }
      
      return NextResponse.json({ success: true, data: entry })
    } else {
      // Get list of HTML code entries
      const userId = searchParams.get('userId')
      const isPublic = searchParams.get('public') === 'true'
      const templateType = searchParams.get('type')
      const tags = searchParams.get('tags')?.split(',').filter(Boolean)
      const limit = parseInt(searchParams.get('limit') || '20')
      const offset = parseInt(searchParams.get('offset') || '0')

      const entries = await db.findMany({
        userId: userId || undefined,
        isPublic: isPublic || undefined,
        templateType: templateType || undefined,
        tags: tags || undefined,
        limit,
        offset
      })

      return NextResponse.json({ 
        success: true, 
        data: entries,
        pagination: {
          limit,
          offset,
          count: entries.length
        }
      })
    }
  } catch (error) {
    console.error('GET /api/html-code error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate required fields
    if (!body.title || !body.htmlContent) {
      return NextResponse.json(
        { error: 'Title and HTML content are required' },
        { status: 400 }
      )
    }

    // Validate HTML content size (limit to 1MB)
    if (body.htmlContent.length > 1024 * 1024) {
      return NextResponse.json(
        { error: 'HTML content too large (max 1MB)' },
        { status: 400 }
      )
    }

    // Create new HTML code entry
    const entry = await db.create({
      title: body.title,
      description: body.description,
      htmlContent: body.htmlContent,
      userId: body.userId,
      isPublic: body.isPublic || false,
      tags: body.tags || [],
      templateType: body.templateType
    })

    return NextResponse.json({ 
      success: true, 
      data: entry 
    }, { status: 201 })

  } catch (error) {
    console.error('POST /api/html-code error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID parameter is required' },
        { status: 400 }
      )
    }

    const updatedEntry = await db.update(id, body)
    
    if (!updatedEntry) {
      return NextResponse.json(
        { error: 'HTML code not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      data: updatedEntry 
    })

  } catch (error) {
    console.error('PUT /api/html-code error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID parameter is required' },
        { status: 400 }
      )
    }

    const deleted = await db.delete(id)
    
    if (!deleted) {
      return NextResponse.json(
        { error: 'HTML code not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      message: 'HTML code deleted successfully' 
    })

  } catch (error) {
    console.error('DELETE /api/html-code error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Download endpoint with analytics
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const action = searchParams.get('action')

    if (!id) {
      return NextResponse.json(
        { error: 'ID parameter is required' },
        { status: 400 }
      )
    }

    if (action === 'download') {
      await db.incrementDownloadCount(id)
      return NextResponse.json({ 
        success: true, 
        message: 'Download count incremented' 
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )

  } catch (error) {
    console.error('PATCH /api/html-code error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 