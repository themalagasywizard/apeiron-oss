import { NextRequest, NextResponse } from "next/server";

// Web search API optimized for serverless environments (Netlify/Vercel)
// Kept under 25 seconds to work within serverless function limits
export async function POST(request: NextRequest) {
  try {
    const { query, maxResults = 5, userLocation, extractContent = false } = await request.json();
    
    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: "Search query is required" },
        { status: 400 }
      );
    }
    
    console.log(`Web search request: "${query}" (max results: ${maxResults}, location: ${userLocation || 'not specified'}, extract content: ${extractContent})`);
    
    // Perform web search to get results
    const searchResults = await performWebScrapingSearch(query, maxResults, userLocation);
    
    // If content extraction is requested, fetch content from top results
    let enhancedResults = searchResults;
    
    if (extractContent && searchResults.length > 0) {
      try {
        console.log(`Extracting content from ${Math.min(3, searchResults.length)} top search results`);
        
        // Call the web-browse API to extract content from the top results
        const urls = searchResults.slice(0, 3).map(result => result.url);
        
        const browseResponse = await fetch(`${new URL(request.url).origin}/api/web-browse`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls, query })
        });
        
        if (browseResponse.ok) {
          const browseData = await browseResponse.json();
          
          if (browseData.success && browseData.results && browseData.results.length > 0) {
            // Enhance search results with extracted content
            enhancedResults = searchResults.map(result => {
              // Find matching content extraction result
              const contentData = browseData.results.find((item: { url: string }) => item.url === result.url);
              
              if (contentData) {
                return {
                  ...result,
                  extractedContent: contentData.content,
                  extractedTitle: contentData.title || result.title,
                  contentExtracted: true
                };
              }
              
              return result;
            });
            
            console.log(`Enhanced ${browseData.results.length} search results with extracted content`);
          }
        } else {
          console.error("Content extraction failed:", await browseResponse.text());
        }
      } catch (extractError) {
        console.error("Error extracting content:", extractError);
        // Continue with regular search results
      }
    }
    
    return NextResponse.json({
      query,
      results: enhancedResults,
      contentExtracted: extractContent,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("Web search error:", error);
    return NextResponse.json(
      { 
        error: "Failed to perform web search",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

// Web search implementation using SerpAPI
async function performWebSearch(query: string, maxResults: number, userLocation?: string) {
  try {
    const serpApiKey = process.env.SERP_API_KEY;
    
    if (!serpApiKey) {
      console.log("SERP_API_KEY not found, using web scraping fallback");
      return await performWebScrapingSearch(query, maxResults, userLocation);
    }

    // Build SerpAPI URL with additional parameters for better results
    let serpApiUrl = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${serpApiKey}&num=${Math.min(maxResults, 10)}`;
    
    // Add location parameter if provided
    if (userLocation) {
      serpApiUrl += `&location=${encodeURIComponent(userLocation)}`;
    } else {
      // Default to US results if no location specified
      serpApiUrl += `&gl=us&hl=en`;
    }
    
    // Add language filter for English results
    serpApiUrl += `&lr=lang_en`;

    const response = await fetch(serpApiUrl);
    
    if (!response.ok) {
      throw new Error(`SerpAPI request failed: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`SerpAPI error: ${data.error}`);
    }

    const results = [];
    
    // Process organic results
    if (data.organic_results) {
      for (const result of data.organic_results.slice(0, maxResults)) {
        // Filter out results that don't have English content or have suspicious domains
        if (shouldIncludeResult(result)) {
          results.push({
            title: result.title || "No title",
            url: result.link || "#",
            snippet: result.snippet || "No description available",
            timestamp: new Date().toISOString(),
            source: getDomainFromUrl(result.link || "")
          });
        }
      }
    }

    // Process knowledge graph if available
    if (data.knowledge_graph && results.length < maxResults) {
      results.unshift({
        title: data.knowledge_graph.title || "Knowledge Graph",
        url: data.knowledge_graph.source?.link || "#",
        snippet: data.knowledge_graph.description || "Knowledge graph information",
        timestamp: new Date().toISOString(),
        source: getDomainFromUrl(data.knowledge_graph.source?.link || "")
      });
    }

    return results.slice(0, maxResults);
    
  } catch (error) {
    console.error("SerpAPI search error:", error);
    // Fallback to web scraping if SerpAPI fails
    return await performWebScrapingSearch(query, maxResults, userLocation);
  }
}

// Helper function to get domain from URL for source attribution
function getDomainFromUrl(url: string): string {
  try {
    if (!url || url === '#') return '';
    const domain = new URL(url).hostname;
    return domain.replace(/^www\./, '');
  } catch {
    return '';
  }
}

// Helper function to filter out low-quality or non-English results
function shouldIncludeResult(result: any): boolean {
  if (!result.link) return false;
  
  // Check for suspicious domains or known low-quality content sites
  const suspiciousDomains = [
    '.cn/', // Chinese domains
    '.ru/', // Russian domains
    'blogspot.', // Often low quality content
    'pinterest.', // Not usually informative content
    'instagram.', // Not usually informative content
  ];
  
  for (const domain of suspiciousDomains) {
    if (result.link.includes(domain)) {
      return false;
    }
  }
  
  // Check if content appears to be non-English
  const nonEnglishPatterns = [
    /[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\uFF00-\uFFEF\u4E00-\u9FAF]/g, // Japanese, Chinese
    /[\u0400-\u04FF]/g, // Cyrillic
    /[\u0600-\u06FF]/g, // Arabic
  ];
  
  for (const pattern of nonEnglishPatterns) {
    if (pattern.test(result.title || '') || pattern.test(result.snippet || '')) {
      return false;
    }
  }
  
  return true;
}

// Advanced web scraping search using multiple search engines
async function performWebScrapingSearch(query: string, maxResults: number, userLocation?: string) {
  try {
    console.log("Using web scraping search");
    
    const results = [];
    
    // Try multiple search approaches
    const searchPromises = [
      searchBing(query, Math.ceil(maxResults / 2), userLocation),
      searchDuckDuckGoScrape(query, Math.ceil(maxResults / 2)),
    ];
    
    const searchResults = await Promise.allSettled(searchPromises);
    
    // Combine results from all sources
    for (const result of searchResults) {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        results.push(...result.value);
      }
    }
    
    // Remove duplicates and limit results
    const uniqueResults = results
      .filter((result, index, self) => 
        index === self.findIndex(r => r.url === result.url)
      )
      // Filter out non-English or suspicious results
      .filter(result => {
        const nonEnglishPatterns = [
          /[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\uFF00-\uFFEF\u4E00-\u9FAF]/g, // Japanese, Chinese
          /[\u0400-\u04FF]/g, // Cyrillic
          /[\u0600-\u06FF]/g, // Arabic
        ];
        
        for (const pattern of nonEnglishPatterns) {
          if (pattern.test(result.title || '') || pattern.test(result.snippet || '')) {
            return false;
          }
        }
        
        // Check for suspicious domains
        const url = result.url.toLowerCase();
        if (url.includes('.cn/') || url.includes('.ru/')) {
          return false;
        }
        
        return true;
      });
    
    return uniqueResults.slice(0, maxResults);
    
  } catch (error) {
    console.error("Web scraping search error:", error);
    
    // Last resort: return a search result that at least gives some guidance
    return [
      {
        title: `Search results for "${query}"`,
        url: `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=en&cc=us`,
        snippet: `I was unable to fetch detailed search results for "${query}". Please try searching manually or check your internet connection. You can click this link to search directly.`,
        timestamp: new Date().toISOString(),
        source: "bing.com"
      }
    ];
  }
}

// Bing search (often has good results and is more permissive than Google)
async function searchBing(query: string, maxResults: number, userLocation?: string) {
  try {
    // Build Bing search URL with location and language parameters
    let searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=${maxResults}&setlang=en`;
    
    // Add location if provided, otherwise default to US
    if (userLocation) {
      searchUrl += `&cc=${encodeURIComponent(userLocation)}`;
    } else {
      searchUrl += `&cc=US`;
    }
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Bing search failed: ${response.status}`);
    }
    
    const html = await response.text();
    const results = [];
    
    // Parse Bing search results using regex patterns
    const titlePattern = /<h2[^>]*><a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g;
    const snippetPattern = /<p class="b_lineclamp[^"]*"[^>]*>([^<]*)<\/p>/g;
    
    const titleMatches = [...html.matchAll(titlePattern)];
    const snippetMatches = [...html.matchAll(snippetPattern)];
    
    for (let i = 0; i < Math.min(titleMatches.length, maxResults); i++) {
      const titleMatch = titleMatches[i];
      const snippetMatch = snippetMatches[i];
      
      if (titleMatch && titleMatch[1] && titleMatch[2]) {
        let url = titleMatch[1];
        // Clean up Bing redirect URLs
        if (url.includes('bing.com/ck/a')) {
          const urlMatch = url.match(/&u=([^&]*)/);
          if (urlMatch) {
            url = decodeURIComponent(urlMatch[1]);
          }
        }
        
        results.push({
          title: titleMatch[2].trim(),
          url: url,
          snippet: snippetMatch ? snippetMatch[1].trim() : "No description available",
          timestamp: new Date().toISOString(),
          source: getDomainFromUrl(url)
        });
      }
    }
    
    return results;
    
  } catch (error) {
    console.error("Bing search error:", error);
    return [];
  }
}

// DuckDuckGo scraping (alternative approach)
async function searchDuckDuckGoScrape(query: string, maxResults: number) {
  try {
    // First get the search page - use region=us to prefer US results
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=us-en`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    
    if (!response.ok) {
      throw new Error(`DuckDuckGo search failed: ${response.status}`);
    }
    
    const html = await response.text();
    const results = [];
    
    // Parse DuckDuckGo results
    const resultPattern = /<div class="result[^"]*">[\s\S]*?<a class="result__a" href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    
    const matches = [...html.matchAll(resultPattern)];
    
    for (let i = 0; i < Math.min(matches.length, maxResults); i++) {
      const match = matches[i];
      
      if (match && match[1] && match[2]) {
        // Extract and decode the URL properly
        let url = match[1];
        
        // DuckDuckGo uses redirects - extract the actual URL
        if (url.includes('/d.js?') || url.includes('duckduckgo.com/l/?')) {
          // Extract the uddg parameter which contains the actual URL
          const urlMatch = url.match(/[?&]uddg=([^&]+)/);
          if (urlMatch && urlMatch[1]) {
            url = decodeURIComponent(urlMatch[1]);
          }
        }
        
        // Ensure URL has proper protocol
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'https://' + url;
        }
        
        // Clean HTML from title and snippet
        const title = match[2].replace(/<[^>]*>/g, '').trim();
        const snippet = match[3].replace(/<[^>]*>/g, '').trim();
        
        results.push({
          title: title,
          url: url,
          snippet: snippet || "No description available",
          timestamp: new Date().toISOString(),
          source: getDomainFromUrl(url)
        });
      }
    }
    
    return results;
    
  } catch (error) {
    console.error("DuckDuckGo scrape error:", error);
    return [];
  }
} 