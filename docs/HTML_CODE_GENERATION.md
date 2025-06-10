# HTML Code Generation Feature

The AI Chat Platform now includes comprehensive HTML code generation capabilities with secure rendering, download functionality, and database storage optimized for Netlify and PostgreSQL deployment.

## ✨ Features

### 🎨 HTML Code Generation
- **AI-Powered Generation**: Ask the AI to create HTML code for any purpose
- **Template Support**: Pre-built templates for headers, navigation, alerts, and complete pages
- **Modern Standards**: Uses Tailwind CSS, responsive design, and accessibility best practices
- **Theme Support**: Automatic dark/light mode with theme toggle functionality

### 🔒 Secure Rendering
- **DOMPurify Integration**: All HTML content is sanitized before rendering
- **Iframe Sandboxing**: Live previews run in secure sandbox environments
- **Content Security**: Whitelist-based tag and attribute filtering
- **XSS Protection**: Multiple layers of protection against malicious code

### 📱 User Interface
- **Split View**: Side-by-side code and preview panels
- **Responsive Design**: Works seamlessly on desktop and mobile
- **Interactive Controls**: Toggle code view, preview, fullscreen mode
- **Download Integration**: One-click download with automatic database storage

### 💾 Database Integration
- **PostgreSQL Storage**: Optimized for Netlify deployment
- **Version Control**: Track changes and updates to generated code
- **Analytics**: Download counts and usage statistics
- **Public Gallery**: Share and discover community-generated templates

## 🛠️ Technical Implementation

### Architecture Overview
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   AI Response   │ → │ HTML Detection  │ → │ Security Check  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Download      │ ← │ Database Store  │ ← │ Preview Render  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Components

#### HTMLPreview Component
- **Location**: `components/html-preview.tsx`
- **Purpose**: Secure HTML rendering and preview
- **Features**: Code view, live preview, download functionality
- **Security**: DOMPurify sanitization, iframe sandboxing

#### HTML Templates Library
- **Location**: `lib/html-templates.ts`
- **Purpose**: Template generation and HTML detection
- **Templates**: Base HTML, headers, navigation, alerts, complete pages
- **Utilities**: Content detection, filename generation

#### API Endpoints
- **Location**: `app/api/html-code/route.ts`
- **Methods**: GET, POST, PUT, DELETE, PATCH
- **Features**: CRUD operations, analytics tracking, public gallery

### Database Schema

#### Main Tables
- **html_codes**: Store generated HTML content
- **html_code_analytics**: Track usage and downloads
- **user_sessions**: Manage user sessions
- **conversations**: Store chat history

#### Key Features
- **UUID Primary Keys**: For distributed systems
- **JSONB Storage**: Flexible metadata and tags
- **Full-Text Search**: Title and description indexing
- **Automatic Timestamps**: Created/updated tracking

## 🚀 Usage Guide

### For Users

#### Generating HTML Code
1. **Ask the AI**: Request HTML code for any purpose
   ```
   "Create a modern landing page with header and navigation"
   "Generate alert components for notifications"
   "Build a responsive contact form"
   ```

2. **Review the Output**: The AI will provide HTML code in code blocks
3. **Preview**: Click the eye icon to see live preview
4. **Download**: Click download to save and store in database
5. **Share**: Public templates can be shared with the community

#### Example Prompts
- "Create a responsive navigation bar with dropdown menus"
- "Generate a hero section with call-to-action buttons"
- "Build a contact form with validation styling"
- "Create an admin dashboard layout"
- "Generate error and success alert components"

### For Developers

#### HTML Detection
The system automatically detects HTML code in AI responses using pattern matching:
```typescript
import { detectHTMLInContent } from '@/lib/html-templates'

const detection = detectHTMLInContent(aiResponse)
if (detection.hasHTML) {
  // Render HTML preview component
}
```

#### Template Generation
Use built-in template generators for consistent output:
```typescript
import { generateCompletePage, generateHeader, generateAlert } from '@/lib/html-templates'

const page = generateCompletePage({
  header: { title: "My Site", subtitle: "Welcome" },
  navigation: { items: [...] },
  alerts: [{ type: "success", message: "Welcome!" }]
})
```

#### Database Operations
Store and retrieve HTML code entries:
```typescript
// Save HTML code
const response = await fetch('/api/html-code', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'My Template',
    htmlContent: htmlCode,
    isPublic: true,
    tags: ['landing-page', 'responsive']
  })
})

// Retrieve public templates
const templates = await fetch('/api/html-code?public=true')
```

## 📚 API Reference

### HTML Code Endpoints

#### GET /api/html-code
Retrieve HTML code entries with optional filtering.

**Query Parameters:**
- `id`: Get specific entry by ID
- `public`: Filter by public visibility (true/false)
- `type`: Filter by template type
- `tags`: Comma-separated tag list
- `limit`: Number of results (default: 20)
- `offset`: Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Modern Landing Page",
      "description": "A responsive landing page",
      "htmlContent": "<!DOCTYPE html>...",
      "tags": ["landing-page", "responsive"],
      "templateType": "complete",
      "downloadCount": 42,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "count": 1
  }
}
```

#### POST /api/html-code
Create a new HTML code entry.

**Request Body:**
```json
{
  "title": "My Template",
  "description": "Optional description",
  "htmlContent": "<!DOCTYPE html>...",
  "isPublic": false,
  "tags": ["tag1", "tag2"],
  "templateType": "complete"
}
```

#### PUT /api/html-code?id={id}
Update an existing HTML code entry.

#### DELETE /api/html-code?id={id}
Delete an HTML code entry.

#### PATCH /api/html-code?id={id}&action=download
Increment download counter for analytics.

## 🔧 Deployment

### Netlify Deployment

#### Environment Variables
```bash
# Required for production
DATABASE_URL=postgresql://user:password@host:port/database
POSTGRES_URL=postgresql://user:password@host:port/database

# Optional for enhanced features
OPENAI_API_KEY=your_openai_key
CLAUDE_API_KEY=your_claude_key
```

#### Database Setup
1. **Create PostgreSQL Database**: Use Neon, Supabase, or similar
2. **Run Schema**: Execute `docs/database-schema.sql`
3. **Configure Connection**: Set DATABASE_URL environment variable
4. **Test Connection**: Verify API endpoints work

#### Build Configuration
```javascript
// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // For Netlify deployment
  experimental: {
    serverComponentsExternalPackages: ['pg']
  }
}

export default nextConfig
```

### PostgreSQL Providers

#### Recommended Services
1. **Neon**: Serverless PostgreSQL for modern apps
2. **Supabase**: Open source Firebase alternative
3. **Railway**: Developer-first database hosting
4. **PlanetScale**: MySQL alternative with branching

#### Connection Example (Neon)
```typescript
import { Pool } from '@neondatabase/serverless'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function executeQuery(query: string, params: any[] = []) {
  const client = await pool.connect()
  try {
    const result = await client.query(query, params)
    return result
  } finally {
    client.release()
  }
}
```

## 🔒 Security Considerations

### Content Sanitization
- **DOMPurify**: Removes dangerous HTML elements and attributes
- **Whitelist Approach**: Only allow safe tags and attributes
- **Script Blocking**: No JavaScript execution in previews
- **Style Sanitization**: CSS injection prevention

### Database Security
- **Parameterized Queries**: Prevent SQL injection
- **Input Validation**: Server-side validation for all inputs
- **Rate Limiting**: Prevent abuse and spam
- **Content Length Limits**: Prevent oversized uploads

### Access Control
- **Public/Private Templates**: Control visibility
- **User Sessions**: Track user activity
- **Analytics**: Monitor usage patterns
- **Audit Logs**: Track all database operations

## 📊 Analytics & Monitoring

### Usage Tracking
- **Download Counts**: Track template popularity
- **View Analytics**: Monitor preview usage
- **User Patterns**: Understand user behavior
- **Performance Metrics**: Monitor system performance

### Database Views
- **Public Templates**: Most popular public templates
- **Usage Statistics**: Download and view counts
- **User Activity**: Session and usage tracking
- **System Health**: Database performance monitoring

## 🎯 Future Enhancements

### Planned Features
- [ ] **Real-time Collaboration**: Multi-user editing
- [ ] **Version History**: Track template changes
- [ ] **Template Marketplace**: Buy/sell premium templates
- [ ] **AI Code Review**: Automated code quality checks
- [ ] **Export Options**: PDF, image, and other formats
- [ ] **Integration APIs**: Webhook and external service integration

### Community Features
- [ ] **Template Ratings**: User feedback system
- [ ] **Comments**: Discussion on templates
- [ ] **Forking**: Create variations of existing templates
- [ ] **Collections**: Organize templates into collections
- [ ] **Search**: Advanced search and filtering

## 📝 Contributing

### Development Setup
1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables
4. Run database migrations
5. Start development server: `npm run dev`

### Code Guidelines
- **TypeScript**: Use strict typing
- **Security First**: Always sanitize user input
- **Performance**: Optimize database queries
- **Testing**: Write comprehensive tests
- **Documentation**: Keep docs updated

## 📄 License

This feature is part of the AI Chat Platform and follows the same licensing terms. See the main project LICENSE file for details.

---

For questions or support, please open an issue in the project repository or contact the development team. 