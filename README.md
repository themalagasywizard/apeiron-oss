# Apeiron - Advanced AI Chat & Code Generation Platform

Apeiron is a sophisticated AI chat platform that combines multiple language models and providers into a unified interface. Built with Next.js and hosted on Netlify, it offers advanced features for code generation, web browsing, image generation, and more.

## 🌟 Key Features

### Multi-Model Support
- **OpenRouter Integration**: Access to multiple AI models through a single API key
  - OpenAI models (GPT-4, GPT-3.5)
  - Anthropic models (Claude 3 Opus, Sonnet)
  - Mistral models (Large, Medium, Small)
  - Meta's Llama models
- **Direct Provider Support**:
  - OpenAI
  - Claude
  - Gemini
  - Mistral AI
  - DeepSeek
  - Grok
  - RunwayML

### Advanced Capabilities
- **Code Generation**: Enhanced code generation with syntax highlighting and automatic formatting
- **Web Browsing**: Real-time web search and content extraction capabilities
- **Image Generation**: Support for DALL-E and RunwayML image generation
- **File Attachments**: Upload and process various file types including PDFs and images
- **HTML Code Generation**: Create and preview HTML/CSS code in real-time
- **Video Generation**: Integration with VEO2 for AI video generation

### User Experience
- **Theme Customization**: Multiple theme options with dark/light mode support
- **Conversation Management**: Save, organize, and search through chat history
- **Project Organization**: Group conversations into projects for better organization
- **Mobile Responsive**: Fully responsive design for mobile and tablet devices
- **Real-time Updates**: Live chat updates and streaming responses

## 🚀 Getting Started

### Prerequisites
- Node.js 18.x or higher
- npm or pnpm package manager
- Supabase account for database (optional)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/apeiron-oss.git
cd apeiron-oss
```

2. Install dependencies:
```bash
npm install
# or
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Configure your API keys in `.env.local`:
```env
OPENAI_API_KEY=your_openai_key
OPENROUTER_API_KEY=your_openrouter_key
CLAUDE_API_KEY=your_anthropic_key
GEMINI_API_KEY=your_google_key
MISTRAL_API_KEY=your_mistral_key
DEEPSEEK_API_KEY=your_deepseek_key
GROK_API_KEY=your_grok_key
RUNWAY_API_KEY=your_runway_key
```

5. Start the development server:
```bash
npm run dev
# or
pnpm dev
```

### Database Setup (Optional)
For persistent storage and enhanced features:
1. Create a Supabase project
2. Follow the instructions in `SUPABASE_SETUP.md`
3. Add Supabase environment variables to `.env.local`

## 🛠️ Technical Stack

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Netlify Edge Functions
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Deployment**: Netlify
- **State Management**: React Context
- **UI Components**: Radix UI, Shadcn/ui

## 📚 Documentation

- `IMPLEMENTATION_SUMMARY.md`: Detailed technical implementation overview
- `SUPABASE_SETUP.md`: Database schema and setup instructions
- `docs/ATTACHMENT_SYSTEM.md`: File attachment system documentation
- `docs/HTML_CODE_GENERATION.md`: HTML generation feature documentation
- `docs/VEO2_INTEGRATION.md`: Video generation integration guide

## 🔒 Security Features

- Secure API key handling
- Rate limiting
- Input validation
- XSS protection
- CORS configuration
- Environment variable protection

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines for more details.

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Thanks to all the AI model providers
- The open-source community
- Contributors and testers

## 🔗 Links

- [Project Website](https://apeiron.app)
- [Documentation](https://docs.apeiron.app)
- [Issue Tracker](https://github.com/yourusername/apeiron-oss/issues)
