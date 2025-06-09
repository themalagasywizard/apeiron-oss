// OCR utilities for text extraction from images and PDFs

import { createWorker } from 'tesseract.js';

export interface OCRResult {
  text: string;
  confidence: number;
  processingTime: number;
}

export interface OCROptions {
  language?: string;
  logger?: (m: any) => void;
  errorHandler?: (error: any) => void;
}

/**
 * Extract text from image buffer using Tesseract OCR
 */
export async function extractTextFromImage(
  imageBuffer: Buffer, 
  options: OCROptions = {}
): Promise<OCRResult> {
  const startTime = Date.now();
  
  try {
    const worker = await createWorker(options.language || 'eng', undefined, {
      logger: options.logger || (() => {}),
      errorHandler: options.errorHandler || console.error
    });

    const { data: { text, confidence } } = await worker.recognize(imageBuffer);
    await worker.terminate();

    return {
      text: text.trim(),
      confidence: confidence || 0,
      processingTime: Date.now() - startTime
    };
  } catch (error) {
    if (options.errorHandler) {
      options.errorHandler(error);
    }
    throw new Error(`OCR processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Analyze text quality and provide suggestions
 */
export function analyzeTextQuality(text: string): {
  quality: 'high' | 'medium' | 'low';
  suggestions: string[];
  wordCount: number;
  confidence: number;
} {
  const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
  const hasSpecialChars = /[^a-zA-Z0-9\s\.,!?;:'"()-]/.test(text);
  const avgWordLength = wordCount > 0 ? text.replace(/\s+/g, '').length / wordCount : 0;
  
  let quality: 'high' | 'medium' | 'low' = 'high';
  let confidence = 100;
  const suggestions: string[] = [];

  // Quality assessment
  if (wordCount < 10) {
    quality = 'low';
    confidence -= 30;
    suggestions.push('Very little text extracted - document may be low quality or contain mostly images');
  } else if (wordCount < 50) {
    quality = 'medium';
    confidence -= 15;
    suggestions.push('Limited text content - verify document contains readable text');
  }

  if (hasSpecialChars) {
    confidence -= 20;
    suggestions.push('Contains unusual characters - OCR may have misread some text');
  }

  if (avgWordLength < 3) {
    confidence -= 15;
    suggestions.push('Short average word length - may indicate OCR errors or fragmented text');
  }

  if (avgWordLength > 8) {
    confidence -= 10;
    suggestions.push('Long average word length - may indicate merged words or technical content');
  }

  return {
    quality,
    suggestions,
    wordCount,
    confidence: Math.max(0, Math.min(100, confidence))
  };
}

/**
 * Clean and format extracted text
 */
export function cleanExtractedText(rawText: string): string {
  return rawText
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Fix common OCR errors
    .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between camelCase
    .replace(/(\d)([A-Za-z])/g, '$1 $2') // Add space between numbers and letters
    .replace(/([A-Za-z])(\d)/g, '$1 $2') // Add space between letters and numbers
    // Clean up punctuation
    .replace(/\s+([,.!?;:])/g, '$1') // Remove space before punctuation
    .replace(/([,.!?;:])\s*([A-Z])/g, '$1 $2') // Ensure space after punctuation
    // Remove common OCR artifacts
    .replace(/[|]/g, 'I') // Pipe to I
    .replace(/[`']/g, "'") // Normalize quotes
    .replace(/[""]s/g, '"') // Normalize smart quotes
    .trim();
}

/**
 * Get file processing suggestions based on filename
 */
export function getProcessingSuggestions(filename: string): {
  fileType: string;
  suggestions: string[];
  expectedContent: string;
} {
  const lowerName = filename.toLowerCase();
  
  // Madagascar document analysis
  if (lowerName.includes('madagascar')) {
    return {
      fileType: 'Geographic/Political Document',
      suggestions: [
        'Document appears to be related to Madagascar',
        'May contain geographic, political, or economic information',
        'Consider asking about specific topics: economy, geography, politics, demographics',
        'If dated 2025-05-30, may be a future projection or analysis'
      ],
      expectedContent: 'Geographic data, political analysis, economic reports, or research about Madagascar'
    };
  }

  // Date-based analysis
  if (lowerName.includes('2025') || lowerName.includes('2089')) {
    return {
      fileType: 'Future Analysis/Projection',
      suggestions: [
        'Document contains future dates - may be projections or scenarios',
        'Could be climate modeling, economic forecasting, or science fiction',
        'Consider asking about methodology, assumptions, or data sources',
        'May contain speculative or predictive content'
      ],
      expectedContent: 'Forecasts, projections, scenarios, or speculative analysis'
    };
  }

  // Generic suggestions
  return {
    fileType: 'General Document',
    suggestions: [
      'Upload successful - ready for analysis',
      'Ask specific questions about the content',
      'Describe what information you need from this document',
      'Text extraction may be limited for image-based documents'
    ],
    expectedContent: 'Various types of textual content'
  };
}

/**
 * Format OCR results for user display
 */
export function formatOCRResults(
  result: OCRResult, 
  filename: string,
  originalSize: number
): string {
  const quality = analyzeTextQuality(result.text);
  const suggestions = getProcessingSuggestions(filename);
  
  const cleanText = cleanExtractedText(result.text);
  
  return `[OCR Processing Complete]

File: ${filename}
Size: ${(originalSize / 1024).toFixed(1)} KB
Processing Time: ${(result.processingTime / 1000).toFixed(1)}s
Text Quality: ${quality.quality.toUpperCase()} (${quality.confidence}% confidence)
Words Extracted: ${quality.wordCount}

${suggestions.suggestions.length > 0 ? `Suggestions:
${suggestions.suggestions.map(s => `• ${s}`).join('\n')}

` : ''}${cleanText.length > 0 ? `Extracted Content:
${cleanText}` : 'No readable text could be extracted from this document.'}

${quality.suggestions.length > 0 ? `\nProcessing Notes:
${quality.suggestions.map(s => `• ${s}`).join('\n')}` : ''}`;
} 