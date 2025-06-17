import { NextRequest, NextResponse } from "next/server";

// Configure runtime for Edge Function
export const runtime = 'edge';

// Helper function to extract domain from URL
function getDomainFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    const domainParts = hostname.split('.');
    
    // Handle subdomains
    if (domainParts.length > 2) {
      // Special case for common domains like co.uk
      const lastTwoParts = domainParts.slice(-2).join('.');
      if (['co.uk', 'com.au', 'co.jp'].includes(lastTwoParts)) {
        return domainParts.slice(-3).join('.');
      }
      return domainParts.slice(-2).join('.');
    }
    
    return hostname;
  } catch {
    return url.split('/')[2] || url;
  }
}

// Helper function to clean and normalize URLs
function normalizeUrl(url: string): string {
  try {
    // If URL doesn't start with http/https, add it
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    // Parse and normalize the URL
    const parsedUrl = new URL(url);
    
    // Remove common tracking parameters
    const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'];
    paramsToRemove.forEach(param => parsedUrl.searchParams.delete(param));
    
    return parsedUrl.toString();
  } catch {
    return url; // Return original if parsing fails
  }
}

// Function to fetch and extract content from URLs
async function fetchUrlContent(urls: string[], maxUrls: number = 3): Promise<any[]> {
  // Limit the number of URLs to process
  const urlsToProcess = urls.slice(0, maxUrls);
  
  // Process URLs in parallel
  const contentPromises = urlsToProcess.map(async (url) => {
    try {
      const normalizedUrl = normalizeUrl(url);
      
      // Use the web-search-extract endpoint to get content
      const extractResponse = await fetch(`${new URL(url).origin}/api/web-search-extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalizedUrl })
      });
      
      if (!extractResponse.ok) {
        console.error(`Failed to extract content from ${normalizedUrl}: ${extractResponse.status}`);
        return {
          url: normalizedUrl,
          domain: getDomainFromUrl(normalizedUrl),
          success: false,
          error: `Failed to extract content: ${extractResponse.status}`,
          content: null
        };
      }
      
      const extractData = await extractResponse.json();
      
      return {
        url: normalizedUrl,
        domain: getDomainFromUrl(normalizedUrl),
        title: extractData.title,
        content: extractData.content,
        contentLength: extractData.contentLength,
        success: true,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`Error processing URL ${url}:`, error);
      return {
        url,
        domain: getDomainFromUrl(url),
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        content: null
      };
    }
  });
  
  // Wait for all content to be fetched
  const results = await Promise.allSettled(contentPromises);
  
  // Process results
  return results
    .filter(result => result.status === 'fulfilled')
    .map(result => (result as PromiseFulfilledResult<any>).value)
    .filter(item => item.success && item.content);
}

export async function POST(request: NextRequest) {
  try {
    const { urls, query } = await request.json();
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: "URLs array is required" }, { status: 400 });
    }
    
    console.log(`Processing ${urls.length} URLs for query: ${query || 'No query provided'}`);
    
    // Fetch content from URLs
    const contentResults = await fetchUrlContent(urls, 5); // Process up to 5 URLs
    
    if (contentResults.length === 0) {
      return NextResponse.json({
        success: false,
        message: "No content could be extracted from the provided URLs",
        query,
        results: []
      });
    }
    
    // Return the extracted content
    return NextResponse.json({
      success: true,
      query,
      results: contentResults,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("Web browse error:", error);
    return NextResponse.json({ 
      error: "Failed to browse web content",
      details: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
} 