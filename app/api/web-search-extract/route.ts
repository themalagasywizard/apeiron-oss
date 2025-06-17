import { NextRequest, NextResponse } from "next/server";

// Configure runtime for Edge Function
export const runtime = 'edge';

// Helper function to extract main content from HTML
function extractMainContent(html: string, url: string): string {
  try {
    // Remove script and style elements to clean up the content
    let cleanHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '');
    
    // Try to find main content containers
    const mainContentPatterns = [
      /<main\b[^>]*>([\s\S]*?)<\/main>/i,
      /<article\b[^>]*>([\s\S]*?)<\/article>/i,
      /<div\b[^>]*(?:id|class)=["']?(?:content|main|post|article)["']?[^>]*>([\s\S]*?)<\/div>/i,
      /<div\b[^>]*(?:id|class)=["']?(?:main-content|article-content|post-content)["']?[^>]*>([\s\S]*?)<\/div>/i
    ];
    
    let mainContent = '';
    
    // Try each pattern until we find content
    for (const pattern of mainContentPatterns) {
      const match = cleanHtml.match(pattern);
      if (match && match[1] && match[1].length > 200) {
        mainContent = match[1];
        break;
      }
    }
    
    // If no main content found, take the body content
    if (!mainContent) {
      const bodyMatch = cleanHtml.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
      if (bodyMatch && bodyMatch[1]) {
        mainContent = bodyMatch[1];
      }
    }
    
    // Clean up the extracted content
    if (mainContent) {
      // Remove HTML tags
      mainContent = mainContent
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Limit content length
      if (mainContent.length > 4000) {
        mainContent = mainContent.substring(0, 4000) + '...';
      }
      
      return mainContent;
    }
    
    return "Content extraction failed for this page.";
  } catch (error) {
    console.error("Error extracting content from HTML:", error);
    return `Failed to extract content from ${url}`;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }
    
    console.log(`Extracting content from URL: ${url}`);
    
    // Fetch the webpage content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    
    if (!response.ok) {
      return NextResponse.json({ 
        error: `Failed to fetch URL: ${response.status} ${response.statusText}` 
      }, { status: 500 });
    }
    
    const contentType = response.headers.get('content-type') || '';
    
    // Only process HTML content
    if (!contentType.includes('text/html')) {
      return NextResponse.json({ 
        error: "URL does not point to HTML content",
        contentType 
      }, { status: 400 });
    }
    
    const html = await response.text();
    const extractedContent = extractMainContent(html, url);
    
    // Get page title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "Unknown Title";
    
    return NextResponse.json({
      url,
      title,
      content: extractedContent,
      contentLength: extractedContent.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("Content extraction error:", error);
    return NextResponse.json({ 
      error: "Failed to extract content",
      details: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
} 