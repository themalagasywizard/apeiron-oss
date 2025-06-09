import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

// Type definitions for file processing
export interface ProcessedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  url?: string;
  extractedText?: string;
  thumbnailUrl?: string;
  uploadedAt: string;
}

// Helper function to get file type category
function getFileCategory(mimeType: string): 'image' | 'pdf' | 'document' | 'other' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.includes('document') || mimeType.includes('text')) return 'document';
  return 'other';
}

// Helper function to extract text from PDF
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    // Import pdf-parse dynamically to avoid SSR issues
    const pdf = await import('pdf-parse');
    const data = await pdf.default(buffer);
    return data.text || '[No text content found in PDF]';
  } catch (error) {
    console.error('PDF extraction error:', error);
    return '[Failed to extract PDF content - PDF may be image-based or corrupted]';
  }
}

// Helper function to process image with AI
async function processImageWithAI(buffer: Buffer, mimeType: string): Promise<string> {
  try {
    // Convert buffer to base64 for API call
    const base64Image = buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Image}`;
    
    // This is where you would integrate with OpenAI Vision API
    // For now, we'll return a helpful description for the user
    const imageSizeKB = Math.round(buffer.length / 1024);
    
    return `Image uploaded successfully (${imageSizeKB} KB). ` +
           `You can ask me to analyze this image, describe what's in it, ` +
           `extract text from it, or answer questions about its content.`;
    
    // Example OpenAI Vision API integration (uncomment when you have an API key):
    /*
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Describe what you see in this image in detail.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: dataUrl,
                  detail: 'high'
                },
              },
            ],
          },
        ],
        max_tokens: 500,
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.choices[0]?.message?.content || 'No description available';
    }
    */
    
  } catch (error) {
    console.error('Image processing error:', error);
    return '[Failed to process image - image may be corrupted or unsupported format]';
  }
}

// Helper function to create data URL for small files
function createDataUrl(buffer: Buffer, mimeType: string): string {
  const base64 = buffer.toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

// Main upload handler
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size too large. Maximum 10MB allowed.' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'File type not supported. Supported types: images, PDF, text documents.' },
        { status: 400 }
      );
    }

    // Generate unique ID and convert file to buffer
    const fileId = uuidv4();
    const buffer = Buffer.from(await file.arrayBuffer());
    const category = getFileCategory(file.type);

    // Create processed file object
    const processedFile: ProcessedFile = {
      id: fileId,
      name: file.name,
      type: file.type,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    };

    // For small images, create data URL for immediate display
    if (category === 'image' && file.size < 1024 * 1024) { // 1MB limit for data URLs
      processedFile.url = createDataUrl(buffer, file.type);
      processedFile.thumbnailUrl = processedFile.url; // Same for small images
    }

    // Extract text based on file type
    switch (category) {
      case 'pdf':
        processedFile.extractedText = await extractTextFromPDF(buffer);
        break;
      case 'image':
        processedFile.extractedText = await processImageWithAI(buffer, file.type);
        break;
      case 'document':
        // For text files, read directly
        if (file.type === 'text/plain') {
          processedFile.extractedText = buffer.toString('utf-8');
        } else {
          processedFile.extractedText = '[Document content extraction will be implemented]';
        }
        break;
    }

    // In a real implementation, you would:
    // 1. Upload to Supabase Storage or similar
    // 2. Generate thumbnail for images
    // 3. Store metadata in database
    // 4. Return proper URLs

    return NextResponse.json({
      success: true,
      file: processedFile
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process file upload' },
      { status: 500 }
    );
  }
} 