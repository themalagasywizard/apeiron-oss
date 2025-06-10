# Supabase Setup Instructions

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new account
2. Create a new project
3. Note down your project URL and anon key from the project settings

## 2. Environment Variables

Create a `.env.local` file in your project root and add:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional: For web search functionality
SERP_API_KEY=your_serp_api_key
```

## 3. Database Setup

1. In your Supabase dashboard, go to the SQL Editor
2. Copy and paste the contents of `supabase-schema.sql` into the editor
3. Run the SQL to create the necessary tables and policies

## 4. Authentication Setup

1. In your Supabase dashboard, go to Authentication > Providers
2. Enable Google provider
3. Configure Google OAuth:
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project or select existing one
   - Enable Google+ API
   - Create OAuth 2.0 credentials
   - Add your Supabase callback URL: `https://your-project.supabase.co/auth/v1/callback`
   - **CRITICAL**: Add `https://t3-oss.netlify.app` as an authorized origin
   - **CRITICAL**: Add `https://t3-oss.netlify.app/auth/callback` as an authorized redirect URI
   - Copy Client ID and Client Secret to Supabase

## 5. Row Level Security (RLS)

The schema automatically sets up RLS policies that ensure:
- Users can only see their own data
- Projects, conversations, and messages are properly isolated
- Secure authentication flow

## 6. Features Enabled

With this setup, you get:

### Authentication
- Google OAuth sign-in
- Automatic user profile creation
- Secure session management

### Projects
- Create/edit/delete projects
- Organize conversations by project
- Color-coded project organization

### Conversations
- Save conversations to database
- Real-time synchronization
- Message history preservation

### Drag & Drop
- Move conversations between projects
- Visual feedback during drag operations
- Automatic database updates

### Data Migration
- Automatic migration of local storage data to Supabase
- One-time migration process
- Preserves existing conversations

## 7. Local Development

```bash
npm run dev
```

The app will prompt for authentication and guide users through the sign-in process.

## 8. Production Deployment

Ensure environment variables are set in your hosting provider (Netlify, Vercel, etc.)

## 9. API Keys Security

- AI provider API keys (OpenAI, Claude, etc.) remain stored locally in the browser
- Only conversation data and user profiles are stored in Supabase
- This maintains user control over their API keys while enabling cloud sync

## 10. Troubleshooting

### Common Issues

1. **Authentication callback errors**: Check Google OAuth redirect URLs
2. **Database connection errors**: Verify environment variables
3. **RLS policy errors**: Ensure user authentication is working
4. **Migration issues**: Check browser console for detailed error messages

### Debug Mode

Set `NODE_ENV=development` to enable detailed logging for troubleshooting. 