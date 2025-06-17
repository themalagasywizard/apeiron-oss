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

// Helper function to extract text from PDF with dual-approach processing
async function extractTextFromPDF(buffer: Buffer, filename: string): Promise<string> {
  try {
    console.log('Starting PDF processing for:', filename);
    
    // Detect document type from filename
    const isCV = /\b(cv|resume|curriculum)\b/i.test(filename);
    const isMadagascar = /madagascar/i.test(filename);
    
    let pdfParseSuccess = false;
    let extractedText = '';
    let pageCount = 0;
    
    // PRIMARY APPROACH: Try pdf-parse first (faster and more direct)
    try {
      console.log('Attempting primary extraction with pdf-parse...');
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer, {
        max: 0 // Process all pages
      });
      
      console.log(`pdf-parse: ${data.numpages} pages, ${data.text.length} characters`);
      
      if (data.text && data.text.trim().length > 50) {
        extractedText = data.text;
        pageCount = data.numpages;
        pdfParseSuccess = true;
        console.log('✅ pdf-parse extraction successful');
      } else {
        console.log('⚠️ pdf-parse returned minimal text, trying fallback...');
      }
      
    } catch (pdfParseError) {
      console.log('❌ pdf-parse failed:', (pdfParseError as Error).message || 'Unknown error');
      console.log('🔄 Falling back to pdf-lib extraction...');
    }
    
    // SECONDARY APPROACH: Use pdf-lib for challenging PDFs
    if (!pdfParseSuccess) {
      try {
        console.log('Attempting secondary extraction with pdf-lib...');
        const { PDFDocument } = await import('pdf-lib');
        
        // Convert Buffer to Uint8Array for pdf-lib compatibility
        const uint8Array = new Uint8Array(buffer);
        const pdfDoc = await PDFDocument.load(uint8Array);
        const pages = pdfDoc.getPages();
        pageCount = pages.length;
        
        let pdfLibText = '';
        
        // Note: pdf-lib doesn't have direct text extraction, so we'll combine with OCR approach
        console.log(`pdf-lib: Document loaded successfully with ${pageCount} pages`);
        
        // For pdf-lib, we'll convert to images and use OCR as it's more robust for complex PDFs
        try {
          const pdf2pic = require('pdf2pic');
          const convertToPic = pdf2pic.fromBuffer(buffer, {
            density: 100,           // Lower density for faster processing
            saveFilename: "untitled",
            savePath: "./temp",
            format: "png",
            width: 600,
            height: 600
          });
          
          // Convert first few pages to images for OCR
          const maxPagesToProcess = Math.min(pageCount, 3); // Limit for performance
          console.log(`Converting ${maxPagesToProcess} pages to images for OCR...`);
          
          for (let i = 1; i <= maxPagesToProcess; i++) {
            try {
              const page = await convertToPic(i);
              
              // Use Tesseract on the converted image
              const { createWorker } = await import('tesseract.js');
              const worker = await createWorker('eng');
              
              const { data } = await worker.recognize(page.path);
              await worker.terminate();
              
              if (data.text && data.text.trim().length > 20) {
                pdfLibText += `\n--- Page ${i} ---\n${data.text.trim()}\n`;
              }
              
              // Clean up temp file
              const fs = require('fs').promises;
              try {
                await fs.unlink(page.path);
              } catch (cleanupError) {
                console.log('Cleanup warning:', (cleanupError as Error).message || 'Cleanup failed');
              }
              
            } catch (pageError) {
              console.log(`Page ${i} processing failed:`, (pageError as Error).message || 'Unknown page error');
            }
          }
          
          if (pdfLibText.trim().length > 50) {
            extractedText = pdfLibText.trim();
            console.log('✅ pdf-lib + OCR extraction successful');
          }
          
        } catch (ocrError) {
          console.log('OCR processing failed:', (ocrError as Error).message || 'Unknown OCR error');
          
          // Final fallback: provide helpful guidance even without text extraction
          extractedText = `Document structure detected (${pageCount} pages) but text extraction requires manual processing.`;
        }
        
      } catch (pdfLibError) {
        console.log('❌ pdf-lib failed:', (pdfLibError as Error).message || 'Unknown pdf-lib error');
        throw new Error('Both PDF processing methods failed');
      }
    }
    
    // PROCESS RESULTS: Format extracted text based on success method
    if (extractedText && extractedText.length > 50) {
      const cleanText = extractedText
        .replace(/\s+/g, ' ')
        .replace(/([.!?])\s*\n/g, '$1\n\n')
        .trim();
      
      const processingMethod = pdfParseSuccess ? 'pdf-parse' : 'pdf-lib + OCR';
      const wordCount = cleanText.split(/\s+/).length;
      
      let contextualIntro = "";
      if (isCV) {
        contextualIntro = `✅ CV/Resume Successfully Processed

👤 Document: ${filename}
📊 Pages: ${pageCount}
🔧 Method: ${processingMethod}
📝 Characters: ${cleanText.length}
🔤 Words: ~${wordCount}

💼 CV Analysis Ready! I can help you:
- Review your qualifications and experience
- Suggest improvements to content or structure
- Identify strengths and areas to highlight
- Compare against job requirements
- Format and presentation recommendations`;
      } else if (isMadagascar) {
        contextualIntro = `✅ Madagascar Document Successfully Processed

🌍 Document: ${filename}
📊 Pages: ${pageCount}
🔧 Method: ${processingMethod}
📝 Characters: ${cleanText.length}
🔤 Words: ~${wordCount}

🇲🇬 Madagascar Analysis Ready! I can help analyze:
- Geographic and demographic data
- Economic indicators and projections
- Environmental and conservation topics
- Political and social developments`;
      } else {
        contextualIntro = `✅ PDF Text Extraction Successful

📄 Document: ${filename}
📊 Pages: ${pageCount}
🔧 Method: ${processingMethod}
📝 Characters: ${cleanText.length}
🔤 Words: ~${wordCount}`;
      }
      
      return cleanText;
    }
    
    // FALLBACK GUIDANCE: When both methods provide minimal text
    let contextualGuidance = "";
    if (isCV) {
      contextualGuidance = `📄 CV/Resume Processing Results

🔍 File: ${filename}
📊 Pages: ${pageCount || 'Unknown'}
🔧 Processing: Advanced dual-method attempted
⚠️  Result: Limited text extraction achieved

💼 CV Analysis Support:
Even with challenging text extraction, I can provide comprehensive CV guidance:

🔍 **Professional Review Services:**
- **Experience Analysis**: Review your work history and achievements
- **Skills Assessment**: Evaluate technical and soft skills presentation
- **Format Optimization**: Improve layout and visual impact
- **Content Enhancement**: Strengthen job descriptions and accomplishments
- **Industry Alignment**: Tailor content for specific sectors or roles

📝 **Strategic Improvements:**
- Quantify achievements with specific numbers/results
- Use strong action verbs (achieved, implemented, led, optimized)
- Optimize for Applicant Tracking Systems (ATS)
- Balance white space and content density
- Ensure consistent formatting throughout

🎯 **Next Steps:**
Please share details about:
1. **Your background**: Industry, years of experience, key roles
2. **Target positions**: What types of jobs are you applying for?
3. **Specific concerns**: What aspects of your CV worry you most?
4. **Current challenges**: Are you getting interviews? Response rates?

🚀 Let's optimize your CV for maximum impact! What's your professional background?`;
    } else if (isMadagascar) {
      contextualGuidance = `📄 Madagascar Document Processing Results

🔍 File: ${filename}
📊 Pages: ${pageCount || 'Unknown'}
🔧 Processing: Advanced dual-method attempted
⚠️  Result: Limited text extraction achieved

🌍 Madagascar Expertise Available:
Despite processing challenges, I have comprehensive Madagascar knowledge:

🗺️ **Geographic Analysis:**
- Climate zones and topography
- Natural resources and biodiversity
- Regional development patterns

💼 **Economic Insights:**
- Agriculture and mining sectors
- Tourism industry analysis
- Trade and development indicators

🏛️ **Social & Political Context:**
- Government structure and policies
- Population and demographic trends
- Cultural and linguistic diversity

🌿 **Environmental Topics:**
- Conservation efforts and challenges
- Climate change impacts
- Biodiversity protection initiatives

💭 **How to proceed:**
1. **Describe the content**: What topics does the document cover?
2. **Share key data**: Mention specific numbers, charts, or findings
3. **Ask targeted questions**: What Madagascar information do you need?

🚀 Ready to provide Madagascar expertise! What aspects does your document focus on?`;
    } else {
      contextualGuidance = `📄 Advanced PDF Processing Results

🔍 File: ${filename}
📊 Pages: ${pageCount || 'Unknown'}
🔧 Processing: Dual-method extraction attempted (pdf-parse → pdf-lib + OCR)
⚠️  Result: Complex document structure detected

🛠️ **Processing Details:**
- **Primary Method**: pdf-parse (fast text extraction)
- **Secondary Method**: pdf-lib + OCR (robust fallback)
- **Local Processing**: No database required
- **Supported Features**: Multi-approach text extraction

💭 **Alternative Approaches:**
1. **Describe the content**: Tell me what you see in the document
2. **Share key information**: Mention specific data, charts, or findings
3. **Ask targeted questions**: What analysis do you need?
4. **Consider re-formatting**: Sometimes saving as "text-searchable PDF" helps

🚀 Ready to help based on your description! What information does the document contain?`;
    }
    
    return `Unable to extract text from ${filename}. This may be an image-based PDF or encrypted document.`;
    
  } catch (error) {
    console.error('PDF processing error:', error);
    
    // Enhanced error handling with processing method details
    return `❌ Advanced PDF Processing Error

🔍 File: ${filename}
⚠️  Issue: ${error instanceof Error ? error.message : 'Unknown processing error'}

🛠️ **Processing Methods Attempted:**
- **Primary**: pdf-parse (direct text extraction)
- **Secondary**: pdf-lib + OCR (image-based processing)
- **Result**: Both methods encountered issues

🔧 **Technical Details:**
- **Local Processing**: No database required - all processing happens locally
- **Dual Approach**: Maximizes success rate for challenging PDFs
- **Common Issues**: Heavily encrypted files, unusual formats, corruption

💡 **Solutions to Try:**
1. **File Check**: Ensure the PDF opens normally in a PDF viewer
2. **Re-save**: Try "Save As" to create a new, clean copy
3. **Format Convert**: Convert to text-searchable PDF if possible
4. **Manual Description**: Share the content details for analysis

🚀 I'm ready to help analyze your content! What information does the document contain?`;
  }
}

// Helper function to process image with OCR
async function processImageWithOCR(buffer: Buffer, mimeType: string): Promise<string> {
  try {
    console.log('Starting image OCR processing...');
    
    // Skip OCR for now due to compatibility issues
    // We'll return an empty string to ensure the rest of the flow works
    return '';
    
    // The code below is kept for reference but not executed
    /*
    // Import tesseract with proper error handling
    const tesseract = await import('tesseract.js');
    
    // Convert buffer to Blob for Tesseract processing
    const blob = new Blob([buffer], { type: mimeType });
    
    // Use the recognize function directly
    const result = await tesseract.recognize(
      blob,
      'eng',
      {
        logger: progress => console.log('OCR Progress:', progress)
      }
    );
    
    if (result.data.text && result.data.text.trim().length > 10) {
      const cleanText = result.data.text
        .replace(/\s+/g, ' ')
        .replace(/([.!?])\s+/g, '$1\n\n')
        .trim();
      
      return cleanText;
    }
    */
    
  } catch (error) {
    console.error('Image OCR error:', error);
    return '';
  }
}

// Helper function to create data URL for small files
function createDataUrl(buffer: Buffer, mimeType: string): string {
  const base64Data = buffer.toString('base64');
  return `data:${mimeType};base64,${base64Data}`;
}

// Helper function to process image for AI analysis
async function processImageForAI(buffer: Buffer, mimeType: string): Promise<{ url: string; extractedText?: string }> {
  try {
    // Validate and normalize mime type
    const normalizedMimeType = mimeType.toLowerCase();
    if (!normalizedMimeType.startsWith('image/')) {
      throw new Error('Invalid image mime type');
    }

    // Convert buffer to base64
    const base64Data = buffer.toString('base64');
    
    // Create a properly formatted data URL
    // Ensure mime type is explicitly set for better compatibility with AI models
    const dataUrl = `data:${normalizedMimeType};base64,${base64Data}`;
    
    // Validate the data URL format
    if (!dataUrl.startsWith('data:image/')) {
      console.error('Invalid image data URL format');
      throw new Error('Failed to create valid image data URL');
    }

    // Log success with size info
    const sizeKB = Math.round(buffer.length / 1024);
    console.log(`Successfully processed ${normalizedMimeType} image (${sizeKB}KB) for AI analysis`);
    
    // For very large images, add a warning log
    if (sizeKB > 1024) {
      console.warn(`Large image detected (${sizeKB}KB). Some AI providers may have size limits.`);
    }

    // Validate base64 data
    if (!base64Data || base64Data.length === 0) {
      throw new Error('Failed to generate base64 data from image');
    }

    // Log the first 100 characters of the data URL for debugging
    console.log('Generated data URL format:', dataUrl.substring(0, 100) + '...');

    return {
      url: dataUrl,
      extractedText: `Image type: ${normalizedMimeType}, size: ${sizeKB}KB`
    };
  } catch (error) {
    console.error('Error processing image for AI:', error);
    throw error;
  }
}

// Main upload handler
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const mimeType = file.type
    const fileCategory = getFileCategory(mimeType)
    
    let processedData: { url?: string; extractedText?: string } = {}
    
    // Process based on file type
    if (fileCategory === 'image') {
      processedData = await processImageForAI(buffer, mimeType)
    } else if (fileCategory === 'pdf') {
      const extractedText = await extractTextFromPDF(buffer, file.name)
      processedData = { extractedText }
    } else {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
    }

    const processedFile: ProcessedFile = {
      id: uuidv4(),
      name: file.name,
      type: mimeType,
      size: file.size,
      url: processedData.url,
      extractedText: processedData.extractedText,
      uploadedAt: new Date().toISOString()
    }

    return NextResponse.json({ file: processedFile })
  } catch (error) {
    console.error('Upload processing error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process file' },
      { status: 500 }
    )
  }
} 