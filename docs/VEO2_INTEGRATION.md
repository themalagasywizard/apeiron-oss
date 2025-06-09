# VEO2 Video Generation Integration

## Overview

This document describes the integration of Google's VEO 2 video generation model into the T3 Chat platform. VEO 2 is Google's advanced AI model for generating high-quality videos from text prompts.

## Features

### ✨ Core Capabilities
- **Text-to-Video Generation**: Create videos from descriptive text prompts
- **High-Quality Output**: Generate videos in 1080p resolution
- **Multiple Formats**: Support for MP4 and other video formats
- **Customizable Duration**: Generate videos from 2 seconds to 2 minutes
- **Aspect Ratio Control**: Support for 16:9, 9:16, 1:1, and other ratios
- **Real-time Preview**: Live video player with custom controls
- **Download Functionality**: Save generated videos locally

### 🎬 Video Player Features
- Custom video controls with play/pause
- Volume control and mute functionality
- Fullscreen support
- Progress tracking
- Responsive design for mobile and desktop

## Setup Instructions

### 1. API Key Configuration

VEO2 uses Google's API infrastructure. You'll need a Google Cloud API key with VEO2 access:

1. Go to **Settings > Models** in the chat interface
2. Select **Google VEO 2 (Video)** from the provider dropdown
3. Enter your Google API key (same as Gemini API key)
4. Save the configuration

### 2. Model Selection

1. In the model selector, choose **VEO 2** from the available models
2. The model icon will show a red play button indicating video generation capability
3. Start a new conversation or continue an existing one

## Usage Guide

### Basic Video Generation

1. **Select VEO2 Model**: Choose VEO 2 from the model dropdown
2. **Enter Prompt**: Type a descriptive prompt for your video
3. **Send Message**: Click send or press Enter
4. **Wait for Generation**: Video processing takes 2-5 minutes
5. **View Result**: The video will appear above the response

### Example Prompts

```
A golden retriever playing in a sunny park with children laughing in the background

A time-lapse of a flower blooming in spring with morning dew

A futuristic city skyline at sunset with flying cars

A chef preparing a gourmet meal in a modern kitchen

Ocean waves crashing against rocky cliffs during a storm
```

### Advanced Configuration

The VEO2 API supports additional parameters:

- **Duration**: 2s, 5s, 10s, 30s, 1m, 2m
- **Aspect Ratio**: 16:9, 9:16, 1:1, 4:3
- **Resolution**: 720p, 1080p, 4K (depending on plan)
- **Style**: Realistic, cinematic, artistic, documentary

## Technical Implementation

### Architecture

```
User Input → Chat API → VEO2 API → Video Processing → Response Display
```

### API Endpoints

#### POST `/api/veo2`
Generate a new video from a text prompt.

**Request Body:**
```json
{
  "prompt": "A cat playing with a ball of yarn",
  "apiKey": "your-google-api-key",
  "duration": "5s",
  "aspectRatio": "16:9"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "veo2_1234567890",
    "status": "processing",
    "prompt": "A cat playing with a ball of yarn",
    "estimatedCompletionTime": "2-5 minutes",
    "videoConfig": {
      "duration": "5s",
      "aspectRatio": "16:9",
      "resolution": "1080p",
      "format": "mp4"
    }
  }
}
```

#### GET `/api/veo2?jobId=<id>`
Check the status of a video generation job.

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "veo2_1234567890",
    "status": "completed",
    "progress": 100,
    "videoUrl": "https://storage.googleapis.com/videos/veo2_1234567890.mp4",
    "thumbnailUrl": "https://storage.googleapis.com/thumbnails/veo2_1234567890.jpg",
    "duration": "5s",
    "fileSize": "2.5MB"
  }
}
```

### Components

#### VideoPreview Component
Located at `components/video-preview.tsx`

**Props:**
- `videoUrl?: string` - URL of the generated video
- `videoTitle?: string` - Title for the video
- `prompt?: string` - Original text prompt
- `isGenerating?: boolean` - Whether video is still processing
- `onDownload?: (url: string, filename: string) => void` - Download handler

**Features:**
- Loading animation during generation
- Custom video player controls
- Download functionality
- Responsive design
- Error handling

#### Video Detection Logic
Located in `main-ui.tsx`

```typescript
const detectVideoContent = (content: string) => {
  const videoPattern = /🎬.*?Video Generation.*?Processed/i
  const promptPattern = /\*\*Prompt:\*\*\s*(.+?)(?=\n|$)/i
  
  return {
    hasVideo: videoPattern.test(content),
    prompt: promptMatch ? promptMatch[1].trim() : null,
    isGenerating: content.includes('Video generation initiated'),
    videoUrl: null // Extracted from API response
  }
}
```

### Message Flow

1. **User Input**: User types video generation prompt
2. **Model Detection**: System detects VEO2 model selection
3. **API Call**: Request sent to `/api/chat` with VEO2 provider
4. **VEO2 Processing**: Dedicated VEO2 endpoint handles generation
5. **Response Parsing**: Video content detected in response
6. **UI Rendering**: VideoPreview component displays result

## Security Considerations

### API Key Protection
- API keys are stored securely in browser localStorage
- Keys are never exposed in client-side code
- Server-side validation of API key format

### Content Filtering
- Prompts are validated for appropriate content
- Generated videos are scanned for policy compliance
- Rate limiting prevents abuse

### Data Privacy
- Video generation prompts are not stored permanently
- Generated videos can be deleted after download
- User data is handled according to privacy policy

## Deployment

### Environment Variables

For production deployment, set these environment variables:

```bash
# Google Cloud Configuration
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json

# VEO2 Specific
VEO2_API_ENDPOINT=https://generativelanguage.googleapis.com/v1beta
VEO2_MODEL_NAME=veo-2
VEO2_MAX_DURATION=120 # seconds
VEO2_MAX_RESOLUTION=1080p

# Storage Configuration
VIDEO_STORAGE_BUCKET=your-storage-bucket
VIDEO_CDN_URL=https://your-cdn.com
```

### Netlify Configuration

Add to `netlify.toml`:

```toml
[build.environment]
  NODE_VERSION = "18"
  NPM_VERSION = "9"

[[functions]]
  name = "veo2-api"
  runtime = "nodejs18.x"
  timeout = 300 # 5 minutes for video processing

[functions.veo2-api.environment]
  GOOGLE_CLOUD_PROJECT_ID = "your-project-id"
  VEO2_API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta"
```

### Database Schema

For storing video generation history:

```sql
CREATE TABLE video_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  prompt TEXT NOT NULL,
  video_url TEXT,
  thumbnail_url TEXT,
  duration INTEGER, -- in seconds
  aspect_ratio VARCHAR(10),
  resolution VARCHAR(10),
  file_size BIGINT, -- in bytes
  status VARCHAR(20) DEFAULT 'processing',
  job_id VARCHAR(100) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  metadata JSONB
);

CREATE INDEX idx_video_generations_user_id ON video_generations(user_id);
CREATE INDEX idx_video_generations_status ON video_generations(status);
CREATE INDEX idx_video_generations_job_id ON video_generations(job_id);
```

## Troubleshooting

### Common Issues

#### "VEO2 API key not configured"
- **Solution**: Add your Google API key in Settings > Models
- **Note**: Use the same key as Gemini if you have one

#### "Video generation failed"
- **Cause**: Invalid prompt or API quota exceeded
- **Solution**: Try a different prompt or check API usage

#### "Video not loading"
- **Cause**: Network issues or expired video URL
- **Solution**: Refresh the page or regenerate the video

#### "Download not working"
- **Cause**: CORS issues or invalid video URL
- **Solution**: Right-click and "Save video as..." or contact support

### Performance Optimization

#### Client-Side
- Lazy load video components
- Implement video thumbnail previews
- Cache video metadata
- Progressive video loading

#### Server-Side
- Implement job queuing for video generation
- Use CDN for video delivery
- Compress videos for faster loading
- Implement video transcoding pipeline

## Future Enhancements

### Planned Features
- **Batch Video Generation**: Generate multiple videos from one prompt
- **Video Editing**: Basic editing tools (trim, crop, filters)
- **Animation Styles**: Different animation and art styles
- **Voice Integration**: Add AI-generated narration
- **Collaboration**: Share and collaborate on video projects

### API Improvements
- **Webhook Support**: Real-time status updates
- **Advanced Parameters**: More granular control over generation
- **Template System**: Pre-built video templates
- **Analytics**: Usage tracking and optimization insights

## Support

### Documentation
- [Google VEO2 Official Docs](https://ai.google.dev/veo)
- [Video Generation Best Practices](./VIDEO_BEST_PRACTICES.md)
- [API Reference](./API_REFERENCE.md)

### Community
- [Discord Server](https://discord.gg/t3-chat)
- [GitHub Issues](https://github.com/your-repo/issues)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/veo2)

### Contact
- **Email**: support@t3chat.com
- **Twitter**: [@T3Chat](https://twitter.com/t3chat)
- **Website**: [https://t3chat.com](https://t3chat.com)

---

*Last updated: January 2025*
*Version: 1.0.0* 