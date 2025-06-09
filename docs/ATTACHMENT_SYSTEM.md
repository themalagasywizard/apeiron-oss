# File Attachment System

The T3 Chat application now includes comprehensive file attachment support with the following features:

## ✨ Features

### File Upload Support
- **Images**: JPEG, PNG, GIF, WebP, SVG
- **Documents**: PDF, TXT, DOC, DOCX, CSV, Markdown
- **Drag & Drop**: Intuitive drag and drop interface
- **Multiple Files**: Upload multiple files at once
- **File Validation**: Size limits (10MB) and type validation

### Content Processing
- **PDF Text Extraction**: Automatic text extraction from PDF files
- **Image Analysis**: Ready for AI vision integration 
- **Text File Reading**: Direct text content extraction
- **File Metadata**: Size, type, and upload timestamp tracking

### User Interface
- **Attachment Preview**: Shows thumbnails for images, icons for documents
- **File Management**: Remove attachments before sending
- **Visual Feedback**: Loading states and drag/drop indicators
- **Responsive Design**: Works on desktop and mobile

## 🔧 Technical Implementation

### API Endpoint
- **Route**: `/api/upload`
- **Method**: POST
- **Content-Type**: `multipart/form-data`
- **Response**: Processed file metadata with extracted content

### File Processing Flow
1. **Upload**: Files sent to API endpoint via FormData
2. **Validation**: Size and type checking
3. **Processing**: Text extraction based on file type
4. **Storage**: In-memory processing (ready for cloud storage)
5. **Response**: Processed file object with metadata

### Data Structure
```typescript
type ProcessedFile = {
  id: string
  name: string
  type: string
  size: number
  url?: string
  extractedText?: string
  thumbnailUrl?: string
  uploadedAt: string
}
```

## 🚀 Usage

### Basic File Upload
1. Click the paperclip icon in the chat input
2. Select files from your device
3. Files are automatically processed and attached
4. Send your message with attachments

### Drag and Drop
1. Drag files from your file manager
2. Drop them onto the chat input area
3. Files are automatically uploaded and attached

### AI Integration
- **PDF Content**: Extracted text is sent to AI for analysis
- **Images**: Ready for vision AI integration
- **Context**: File content becomes part of conversation context

## 🔧 Configuration

### File Size Limits
- Default: 10MB per file
- Configure in: `app/api/upload/route.ts`
- Validation: Client and server-side

### Supported File Types
Update the allowed types array in the API route:
```typescript
const allowedTypes = [
  'image/jpeg',
  'image/png',
  'application/pdf',
  // Add more types as needed
]
```

### Storage Integration
The system is designed to integrate with cloud storage:

1. **Supabase Storage** (Recommended)
2. **AWS S3**
3. **Google Cloud Storage**
4. **Azure Blob Storage**

## 🔌 Extensions

### Adding AI Vision
To enable image analysis with OpenAI Vision:

1. Add OpenAI API key to environment
2. Uncomment vision code in `processImageWithAI`
3. Configure model preferences

### Adding More File Types
1. Update `validateFileType` function
2. Add processing logic for new types
3. Update UI icons and display logic

### Cloud Storage Integration
1. Install cloud storage SDK
2. Update upload route to save files
3. Return public URLs in response
4. Add cleanup for expired files

## 🛠️ Development

### Local Development
```bash
npm run dev
```

### Testing File Uploads
1. Start development server
2. Upload test files of different types
3. Check browser network tab for API responses
4. Verify text extraction in chat context

### Adding New Processors
1. Create processor function in API route
2. Add to file type switch statement
3. Test with sample files
4. Update documentation

## 📝 File Processing Details

### PDF Processing
- Uses `pdf-parse` library
- Extracts text content automatically
- Handles password-protected PDFs
- Returns error messages for corrupted files

### Image Processing
- Creates data URLs for small images
- Ready for AI vision integration
- Supports thumbnails generation
- Handles various image formats

### Text Files
- Direct UTF-8 text reading
- Supports various encodings
- Preserves formatting where possible
- Handles large text files efficiently

## 🔒 Security Considerations

### File Validation
- Server-side type checking
- Size limit enforcement
- Content type verification
- Malware scanning ready

### Data Privacy
- Local processing by default
- No permanent storage without consent
- User-controlled file retention
- GDPR compliance ready

### Rate Limiting
- Implement upload rate limits
- Monitor storage usage
- Prevent abuse patterns
- User quota management

## 🐛 Troubleshooting

### Common Issues
1. **Upload fails**: Check file size and type
2. **PDF text empty**: File may be image-based
3. **Image not displaying**: Check data URL generation
4. **Large files slow**: Implement progress indicators

### Debug Mode
Enable detailed logging by setting:
```typescript
const DEBUG_UPLOADS = process.env.NODE_ENV === 'development'
```

### Error Messages
The system provides user-friendly error messages for:
- File too large
- Unsupported file type
- Processing failures
- Network errors

## 🔮 Future Enhancements

### Planned Features
- [ ] Real-time upload progress
- [ ] File compression options
- [ ] Batch file operations
- [ ] File sharing capabilities
- [ ] Version control for files
- [ ] OCR for image text extraction
- [ ] Audio/video file support
- [ ] File collaboration features

### Integration Roadmap
- [ ] Supabase Storage
- [ ] OpenAI Vision API
- [ ] PDF password handling
- [ ] Image editing tools
- [ ] File search and indexing
- [ ] Advanced text extraction
- [ ] File format conversion
- [ ] Backup and sync

## 📚 Resources

- [PDF-Parse Documentation](https://www.npmjs.com/package/pdf-parse)
- [OpenAI Vision API](https://platform.openai.com/docs/guides/vision)
- [File API Web Standard](https://developer.mozilla.org/en-US/docs/Web/API/File)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction) 