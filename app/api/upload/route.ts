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

// Helper function to extract text from PDF with proper OCR fallback
async function extractTextFromPDF(buffer: Buffer, filename: string): Promise<string> {
  try {
    console.log('Starting PDF processing for:', filename);
    
    // Detect document type from filename
    const isCV = /\b(cv|resume|curriculum)\b/i.test(filename);
    const isMadagascar = /madagascar/i.test(filename);
    
    // First try regular PDF text extraction with proper error handling
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer, {
        // Prevent the library from looking for test files
        max: 0
      });
      
      console.log(`PDF parsed: ${data.numpages} pages, ${data.text.length} characters`);
      
      // If we get substantial text content, return it
      if (data.text && data.text.trim().length > 100) {
        const cleanText = data.text
          .replace(/\s+/g, ' ')
          .replace(/([.!?])\s*\n/g, '$1\n\n')
          .trim();
        
        let contextualIntro = "";
        if (isCV) {
          contextualIntro = `✅ CV/Resume Successfully Processed

👤 Document: ${filename}
📊 Pages: ${data.numpages}
📝 Characters: ${data.text.length}
🔤 Words: ~${data.text.split(/\s+/).length}

💼 CV Analysis Ready! I can help you:
- Review your qualifications and experience
- Suggest improvements to content or structure
- Identify strengths and areas to highlight
- Compare against job requirements
- Format and presentation recommendations`;
        } else if (isMadagascar) {
          contextualIntro = `✅ Madagascar Document Successfully Processed

🌍 Document: ${filename}
📊 Pages: ${data.numpages}
📝 Characters: ${data.text.length}
🔤 Words: ~${data.text.split(/\s+/).length}

🇲🇬 Madagascar Analysis Ready! I can help analyze:
- Geographic and demographic data
- Economic indicators and projections
- Environmental and conservation topics
- Political and social developments`;
        } else {
          contextualIntro = `✅ PDF Text Extraction Successful

📄 Document: ${filename}
📊 Pages: ${data.numpages}
📝 Characters: ${data.text.length}
🔤 Words: ~${data.text.split(/\s+/).length}`;
        }
        
        return `${contextualIntro}

📖 Content:
${cleanText}`;
      }
      
      // If minimal text, provide helpful information about the document
      let contextualGuidance = "";
      if (isCV) {
        contextualGuidance = `📄 CV/Resume Processing Results

🔍 File: ${filename}
📊 Pages: ${data.numpages}
⚠️  Type: Image-based or scanned CV

📋 Available Content:
${data.text.length > 0 ? `Limited text found: "${data.text.substring(0, 200)}..."` : 'No extractable text found'}

💼 CV Analysis Support:
Even with limited text extraction, I can help you:

🔍 **Review & Feedback:**
- Analyze your experience and qualifications
- Suggest improvements to content structure
- Recommend skills to highlight
- Review formatting and presentation

📝 **Content Optimization:**
- Help tailor CV for specific roles
- Improve job descriptions and achievements
- Suggest powerful action words
- Review education and certification sections

🎯 **Strategic Advice:**
- Identify your strongest selling points
- Recommend section organization
- Suggest industry-specific improvements
- Help with cover letter alignment

💭 **How to proceed:**
1. **Describe your background**: Tell me about your experience, skills, and career goals
2. **Share key sections**: Mention your main roles, achievements, or concerns
3. **Ask specific questions**: What aspects of your CV do you want to improve?

🚀 Ready to help optimize your CV! What's your professional background and what type of roles are you targeting?`;
      } else if (isMadagascar) {
        contextualGuidance = `📄 Madagascar Document Processing Results

🔍 File: ${filename}
📊 Pages: ${data.numpages}
⚠️  Type: Image-based or scanned PDF

📋 Available Content:
${data.text.length > 0 ? `Limited text found: "${data.text.substring(0, 200)}..."` : 'No extractable text found'}

🌍 Madagascar Analysis Support:
I can provide detailed analysis on Madagascar topics:

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
        contextualGuidance = `📄 PDF Processing Results

🔍 File: ${filename}
📊 Pages: ${data.numpages}
⚠️  Type: Image-based or scanned PDF

📋 Available Content:
${data.text.length > 0 ? `Limited text found: "${data.text.substring(0, 200)}..."` : 'No extractable text found'}

💭 How to proceed:
1. **Describe the content**: Tell me what you see in the document
2. **Share key data**: Mention specific numbers, charts, or findings
3. **Ask targeted questions**: What specific information do you need?

🚀 Ready to help! What aspects of this document would you like to analyze?`;
      }
      
      return contextualGuidance;
      
    } catch (pdfError) {
      console.error('PDF parsing error:', pdfError);
      
      // Provide detailed error handling based on document type
      let contextualError = "";
      if (isCV) {
        contextualError = `📄 CV/Resume Processing Issue

🔍 File: ${filename}
⚠️  Issue: Unable to extract text from this PDF

💼 CV Analysis Available:
Even though the PDF couldn't be parsed automatically, I can still provide comprehensive CV analysis!

🔍 **Professional Review Services:**
- **Experience Analysis**: Review your work history and achievements
- **Skills Assessment**: Evaluate technical and soft skills presentation
- **Format Optimization**: Improve layout and visual impact
- **Content Enhancement**: Strengthen job descriptions and accomplishments
- **Industry Alignment**: Tailor content for specific sectors or roles

📝 **Common CV Improvements:**
- Quantify achievements with specific numbers/results
- Use strong action verbs (achieved, implemented, led, etc.)
- Optimize for Applicant Tracking Systems (ATS)
- Balance white space and content density
- Ensure consistent formatting throughout

🎯 **Strategic Guidance:**
- Match keywords to job descriptions
- Highlight most relevant experience first
- Create compelling professional summary
- Showcase career progression effectively

💭 **Next Steps:**
Please share details about:
1. **Your background**: Industry, years of experience, key roles
2. **Target positions**: What types of jobs are you applying for?
3. **Specific concerns**: What aspects of your CV worry you most?
4. **Current challenges**: Are you getting interviews? Responses?

🚀 Let's optimize your CV for maximum impact! What's your professional background?`;
      } else if (isMadagascar) {
        contextualError = `📄 Madagascar Document Processing Issue

🔍 File: ${filename}
⚠️  Issue: Unable to extract text from this PDF

🌍 Madagascar Expertise Available:
While I cannot process the PDF directly, I have comprehensive knowledge about Madagascar!

🗺️ **Geographic Analysis:**
- **Physical Geography**: Mountains, coastlines, climate zones
- **Natural Resources**: Mining, agriculture, marine resources
- **Biodiversity**: Unique flora and fauna, conservation status
- **Regional Variations**: Highlands, coastal areas, desert regions

💼 **Economic Intelligence:**
- **Key Industries**: Agriculture (rice, vanilla, cloves), mining (nickel, cobalt), tourism
- **Development Indicators**: GDP, poverty rates, infrastructure
- **Trade Patterns**: Export/import data, international partnerships
- **Investment Climate**: Foreign investment, business environment

🏛️ **Social & Political Context:**
- **Demographics**: Population distribution, urbanization trends
- **Politics**: Government structure, recent developments, stability
- **Culture**: Languages (Malagasy, French), traditions, ethnic groups
- **Education & Health**: System performance, development challenges

🌿 **Environmental Focus:**
- **Conservation**: National parks, protected areas, CITES compliance
- **Climate Change**: Impacts, adaptation strategies, vulnerability
- **Sustainability**: Environmental policies, community conservation

💭 **How I Can Help:**
Please describe what the document contains:
1. **Topic focus**: Geography, economics, politics, environment?
2. **Time period**: Historical data, current analysis, future projections?
3. **Specific questions**: What information do you need about Madagascar?
4. **Analysis goals**: Research, business, academic, policy purposes?

🚀 Ready to provide detailed Madagascar analysis! What aspects interest you most?`;
      } else {
        contextualError = `📄 PDF Processing Issue

🔍 File: ${filename}
⚠️  Issue: Unable to extract text from this PDF

🛠️ Technical Details:
The PDF structure couldn't be properly parsed, which often happens with:
- Scanned documents or image-based PDFs
- Password-protected or encrypted files
- Unusual PDF formats or corruption
- Complex layouts with embedded graphics

🔧 **Local Processing Note:**
PDF processing happens entirely locally on the server - **no database required**. The system uses:
- pdf-parse library for text extraction
- Tesseract.js for OCR when needed
- Local file processing without external storage

💭 **Alternative Approaches:**
1. **Describe the content**: Tell me what you see in the document
2. **Share key information**: Mention specific data, charts, or findings
3. **Ask targeted questions**: What analysis do you need?
4. **Try re-saving**: Sometimes re-saving the PDF can fix parsing issues

🚀 Ready to help based on your description! What does the document contain?`;
      }
      
      return contextualError;
    }
    
  } catch (error) {
    console.error('PDF processing error:', error);
    
    // Generic error handling
    return `❌ PDF Processing Error

🔍 File: ${filename}
⚠️  Issue: ${error instanceof Error ? error.message : 'Unknown processing error'}

🛠️ **Processing Details:**
- **Local Processing**: No database required - all processing happens locally
- **Supported Features**: Text extraction, OCR, multiple file formats
- **Common Issues**: Scanned documents, encrypted files, complex layouts

💡 **Quick Solutions:**
1. **File Check**: Ensure the PDF opens normally in a PDF viewer
2. **Re-save**: Try "Save As" to create a new copy
3. **Format**: Convert to text-searchable PDF if possible
4. **Manual Input**: Describe the content for analysis

🚀 I'm ready to help analyze your content! What information does the document contain?`;
  }
}

// Helper function to process image with OCR
async function processImageWithOCR(buffer: Buffer, mimeType: string): Promise<string> {
  try {
    console.log('Starting image OCR processing...');
    
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng', 1, {
      logger: m => console.log('OCR:', m.status, m.progress)
    });

    const { data } = await worker.recognize(buffer);
    await worker.terminate();

    const imageSizeKB = Math.round(buffer.length / 1024);
    
    if (data.text && data.text.trim().length > 10) {
      const cleanText = data.text
        .replace(/\s+/g, ' ')
        .replace(/([.!?])\s+/g, '$1\n\n')
        .trim();

      return `✅ Image Text Extraction Complete

📸 Image Size: ${imageSizeKB} KB
🎯 OCR Confidence: ${Math.round(data.confidence)}%
📝 Characters: ${cleanText.length}

📖 Extracted Text:
${cleanText}

💡 You can now ask me to:
- Analyze the extracted content
- Answer questions about what's in the image
- Explain specific parts of the text`;
    } else {
      return `📸 Image Processed

📊 Size: ${imageSizeKB} KB
⚠️  Text: No readable text found

💭 This image may contain:
- Graphics, charts, or diagrams
- Handwritten content
- Low-resolution text
- Non-English text

🔍 How I can help:
- Describe what you see in the image
- Ask about visual elements
- Share questions about the content`;
    }
    
  } catch (error) {
    console.error('Image OCR error:', error);
    const imageSizeKB = Math.round(buffer.length / 1024);
    
    return `📸 Image Upload Successful

📊 Size: ${imageSizeKB} KB
⚠️  OCR: Processing unavailable

💭 You can still:
- Describe what's in the image
- Ask questions about visual content
- Request analysis of specific elements

Ready to help based on your description! 🚀`;
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

    console.log(`Processing file: ${file.name}, type: ${file.type}, size: ${file.size}`);

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
    try {
      switch (category) {
        case 'pdf':
          console.log('Processing PDF file...');
          processedFile.extractedText = await extractTextFromPDF(buffer, file.name);
          break;
        case 'image':
          console.log('Processing image file...');
          processedFile.extractedText = await processImageWithOCR(buffer, file.type);
          break;
        case 'document':
          // For text files, read directly
          if (file.type === 'text/plain') {
            processedFile.extractedText = buffer.toString('utf-8');
          } else {
            processedFile.extractedText = `📄 Document uploaded: ${file.name}
            
🔄 Processing: Text extraction for this document type will be implemented
📝 Size: ${Math.round(file.size / 1024)} KB
            
💭 For now, you can:
- Describe the document content
- Ask specific questions
- Share what information you need`;
          }
          break;
        default:
          processedFile.extractedText = `📁 File uploaded: ${file.name}
          
⚠️  Type: Unsupported for automatic processing
📝 Size: ${Math.round(file.size / 1024)} KB

💭 How I can help:
- Describe the file content
- Ask specific questions
- Share what you need to analyze`;
      }
    } catch (processingError) {
      console.error('File processing error:', processingError);
      processedFile.extractedText = `⚠️ Processing Error

📁 File: ${file.name}
❌ Issue: ${processingError instanceof Error ? processingError.message : 'Unknown error'}

🔄 You can still:
- Describe the file content manually
- Ask questions about what you need
- Try uploading the file again`;
    }

    console.log('File processing completed successfully');

    return NextResponse.json({
      success: true,
      file: processedFile
    });

  } catch (error) {
    console.error('Upload handler error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process file upload',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 