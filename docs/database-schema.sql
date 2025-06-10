-- PostgreSQL Database Schema for AI Chat Platform HTML Code Generation
-- Optimized for Netlify deployment with Neon, Supabase, or similar PostgreSQL services

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum for template types
CREATE TYPE template_type_enum AS ENUM ('basic', 'header', 'navigation', 'alert', 'complete');

-- HTML Codes table for storing generated HTML content
CREATE TABLE html_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    html_content TEXT NOT NULL,
    user_id VARCHAR(255), -- For future user authentication integration
    is_public BOOLEAN DEFAULT FALSE,
    tags JSONB DEFAULT '[]'::jsonb,
    template_type template_type_enum,
    download_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_html_codes_user_id ON html_codes(user_id);
CREATE INDEX idx_html_codes_is_public ON html_codes(is_public);
CREATE INDEX idx_html_codes_template_type ON html_codes(template_type);
CREATE INDEX idx_html_codes_created_at ON html_codes(created_at DESC);
CREATE INDEX idx_html_codes_tags ON html_codes USING GIN(tags);

-- Full-text search index for title and description
CREATE INDEX idx_html_codes_search ON html_codes USING GIN(
    to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(description, ''))
);

-- User sessions table (for future user management)
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) UNIQUE NOT NULL,
    user_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '30 days'
);

CREATE INDEX idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

-- Chat conversations table (for future conversation persistence)
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    session_id VARCHAR(255),
    user_id VARCHAR(255),
    messages JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_conversations_session_id ON conversations(session_id);
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_created_at ON conversations(created_at DESC);

-- HTML code analytics table
CREATE TABLE html_code_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    html_code_id UUID REFERENCES html_codes(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- 'view', 'download', 'share'
    user_agent TEXT,
    ip_address INET,
    referer TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_html_code_analytics_html_code_id ON html_code_analytics(html_code_id);
CREATE INDEX idx_html_code_analytics_event_type ON html_code_analytics(event_type);
CREATE INDEX idx_html_code_analytics_created_at ON html_code_analytics(created_at DESC);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updating updated_at
CREATE TRIGGER update_html_codes_updated_at BEFORE UPDATE
    ON html_codes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE
    ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_sessions WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ language 'plpgsql';

-- Views for common queries
-- Public HTML codes view
CREATE VIEW public_html_codes AS
SELECT 
    id,
    title,
    description,
    html_content,
    tags,
    template_type,
    download_count,
    created_at,
    updated_at
FROM html_codes 
WHERE is_public = TRUE
ORDER BY created_at DESC;

-- Popular HTML codes view (by download count)
CREATE VIEW popular_html_codes AS
SELECT 
    id,
    title,
    description,
    tags,
    template_type,
    download_count,
    created_at,
    updated_at
FROM html_codes 
WHERE is_public = TRUE AND download_count > 0
ORDER BY download_count DESC, created_at DESC;

-- HTML code analytics summary view
CREATE VIEW html_code_stats AS
SELECT 
    hc.id,
    hc.title,
    hc.download_count,
    COUNT(hca.id) as total_events,
    COUNT(CASE WHEN hca.event_type = 'view' THEN 1 END) as view_count,
    COUNT(CASE WHEN hca.event_type = 'download' THEN 1 END) as analytics_download_count,
    COUNT(CASE WHEN hca.event_type = 'share' THEN 1 END) as share_count,
    MAX(hca.created_at) as last_activity
FROM html_codes hc
LEFT JOIN html_code_analytics hca ON hc.id = hca.html_code_id
WHERE hc.is_public = TRUE
GROUP BY hc.id, hc.title, hc.download_count
ORDER BY total_events DESC, hc.download_count DESC;

-- Insert some sample data for development
INSERT INTO html_codes (title, description, html_content, is_public, tags, template_type) VALUES
(
    'Modern Landing Page',
    'A beautiful, responsive landing page with header, navigation, and hero section',
    '<!DOCTYPE html>
<html lang="en" class="">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Generated by AI Chat Platform">
    <title>Modern Landing Page</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
    <header class="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div class="container mx-auto px-4 py-6">
            <div class="flex items-center justify-between">
                <h1 class="text-gray-900 dark:text-white text-2xl font-bold">Your Brand</h1>
                <nav>
                    <a href="#home" class="px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400">Home</a>
                    <a href="#about" class="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">About</a>
                    <a href="#contact" class="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">Contact</a>
                </nav>
            </div>
        </div>
    </header>
    <main class="container mx-auto px-4 py-8">
        <div class="text-center">
            <h2 class="text-4xl font-bold mb-4">Welcome to the Future</h2>
            <p class="text-xl text-gray-600 dark:text-gray-400 mb-8">Build amazing things with AI-generated HTML</p>
            <button class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium">Get Started</button>
        </div>
    </main>
</body>
</html>',
    TRUE,
    '["landing-page", "responsive", "tailwind", "modern"]'::jsonb,
    'complete'
),
(
    'Alert Components',
    'Various styled alert components for notifications',
    '<div class="space-y-4 p-4">
    <div class="rounded-lg border p-4 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200" role="alert">
        <div class="flex items-start">
            <div class="flex-shrink-0">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>
            </div>
            <div class="ml-3 flex-1">
                <h3 class="text-sm font-medium">Success!</h3>
                <p class="mt-1 text-sm">Your changes have been saved successfully.</p>
            </div>
        </div>
    </div>
</div>',
    TRUE,
    '["alerts", "components", "notifications", "ui"]'::jsonb,
    'alert'
);

-- Grant permissions (adjust based on your user setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

-- Comments for documentation
COMMENT ON TABLE html_codes IS 'Stores AI-generated HTML code snippets and templates';
COMMENT ON TABLE user_sessions IS 'Manages user sessions for the chat platform';
COMMENT ON TABLE conversations IS 'Stores chat conversation history';
COMMENT ON TABLE html_code_analytics IS 'Tracks usage analytics for HTML codes';

COMMENT ON COLUMN html_codes.html_content IS 'The actual HTML code content';
COMMENT ON COLUMN html_codes.tags IS 'JSON array of tags for categorization and search';
COMMENT ON COLUMN html_codes.is_public IS 'Whether the HTML code is publicly accessible';
COMMENT ON COLUMN html_codes.download_count IS 'Number of times this code has been downloaded';

-- End of schema 