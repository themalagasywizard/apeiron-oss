# T3-OSS: Advanced AI Chat Platform

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/themalagasywizards-projects/v0-build-a-website)
[![Built with Next.js](https://img.shields.io/badge/Built%20with-Next.js-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![Database: Supabase](https://img.shields.io/badge/Database-Supabase-black?style=for-the-badge&logo=supabase)](https://supabase.com)

## 🌟 Overview

T3-OSS is a powerful, feature-rich AI chat platform that combines advanced language models with robust project management capabilities. Built with Next.js and powered by Supabase, it offers a seamless, enterprise-grade experience for managing AI conversations across multiple projects.

## ✨ Key Features

### 🔐 Authentication & Security
- **Google OAuth Integration**: Secure sign-in with Google accounts
- **Row Level Security (RLS)**: Enterprise-grade data protection
- **Local API Key Storage**: Secure management of AI provider keys
- **Encrypted Communication**: End-to-end data encryption

### 📊 Project Management
- **Organized Workspaces**: Create and manage multiple projects
- **Drag & Drop Interface**: Intuitive conversation organization
- **Color Coding**: Visual project organization
- **Cross-device Sync**: Access your projects anywhere

### 💬 Advanced Chat Capabilities
- **Multiple AI Models**: Support for various language models
- **File Attachments**: Share and discuss files in conversations
- **Real-time Saving**: Automatic conversation backup
- **Rich Message History**: Complete conversation tracking

### 🔍 Search & Browse Features
- **Web Search Integration**: Access internet information
- **HTML Code Generation**: Create and preview HTML content
- **Image Generation**: AI-powered image creation
- **Video Integration**: Video content support

### 📱 User Experience
- **Responsive Design**: Works on desktop and mobile
- **Real-time Updates**: Instant message synchronization
- **Offline Support**: Local data persistence
- **Cross-platform**: Consistent experience across devices

## 🛠️ Technical Architecture

### Backend Infrastructure
- **Next.js API Routes**: Serverless API endpoints
- **Supabase Database**: PostgreSQL with real-time capabilities
- **Edge Functions**: Optimized serverless computing
- **File Storage**: Efficient attachment handling

### Frontend Technologies
- **React & Next.js**: Modern web framework
- **Tailwind CSS**: Responsive styling
- **shadcn/ui**: Beautiful UI components
- **TypeScript**: Type-safe development

## 🚀 Getting Started

1. **Clone the Repository**
   ```bash
   git clone https://github.com/your-username/T3-oss.git
   cd T3-oss
   ```

2. **Install Dependencies**
   ```bash
   npm install
   # or
   pnpm install
   ```

3. **Configure Environment Variables**
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Run Development Server**
   ```bash
   npm run dev
   # or
   pnpm dev
   ```

## 📚 Documentation

- [Supabase Setup Guide](./SUPABASE_SETUP.md)
- [Implementation Details](./IMPLEMENTATION_SUMMARY.md)
- [HTML Code Generation](./docs/HTML_CODE_GENERATION.md)
- [Attachment System](./docs/ATTACHMENT_SYSTEM.md)
- [VEO2 Integration](./docs/VEO2_INTEGRATION.md)

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines for more details.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🌐 Deployment

The platform is optimized for deployment on Vercel and includes:
- Automatic HTTPS encryption
- Edge function support
- Real-time database connections
- Serverless architecture

## 🔮 Future Roadmap

- Enhanced collaboration features
- Additional AI model integrations
- Advanced project analytics
- Custom AI model fine-tuning
- Team workspace support

---

Built with ❤️ by the T3-OSS team