import { NextRequest, NextResponse } from "next/server";

// Web search API optimized for serverless environments (Netlify/Vercel)
// Kept under 25 seconds to work within serverless function limits
export async function POST(request: NextRequest) {
  try {
    const { query, maxResults = 10 } = await request.json();

    if (!query) {
      return NextResponse.json(
        { error: "Search query is required" },
        { status: 400 }
      );
    }

    console.log("Web search request:", { query, maxResults });

    // Use the web search tool (this assumes the tool is available in your environment)
    // For a real implementation, you might use Google Custom Search, Bing API, or SerpAPI
    const searchResults = await performWebSearch(query, maxResults);

    return NextResponse.json({
      success: true,
      query,
      results: searchResults,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Web search error:", error);
    return NextResponse.json(
      { 
        error: "Web search failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

// Web search implementation using SerpAPI
async function performWebSearch(query: string, maxResults: number) {
  try {
    const serpApiKey = process.env.SERP_API_KEY;
    
    if (!serpApiKey) {
      console.log("SERP_API_KEY not found, using web scraping fallback");
      return await performWebScrapingSearch(query, maxResults);
    }

    const response = await fetch(`https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${serpApiKey}&num=${Math.min(maxResults, 10)}`);
    
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
        results.push({
          title: result.title || "No title",
          url: result.link || "#",
          snippet: result.snippet || "No description available",
          timestamp: new Date().toISOString()
        });
      }
    }

    // Process knowledge graph if available
    if (data.knowledge_graph && results.length < maxResults) {
      results.unshift({
        title: data.knowledge_graph.title || "Knowledge Graph",
        url: data.knowledge_graph.source?.link || "#",
        snippet: data.knowledge_graph.description || "Knowledge graph information",
        timestamp: new Date().toISOString()
      });
    }

    return results.slice(0, maxResults);
    
  } catch (error) {
    console.error("SerpAPI search error:", error);
    // Fallback to web scraping if SerpAPI fails
    return await performWebScrapingSearch(query, maxResults);
  }
}

// Advanced web scraping search using multiple search engines
async function performWebScrapingSearch(query: string, maxResults: number) {
  try {
    console.log("Using web scraping search");
    
    const results = [];
    
    // Try multiple search approaches
    const searchPromises = [
      searchBing(query, Math.ceil(maxResults / 2)),
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
    const uniqueResults = results.filter((result, index, self) => 
      index === self.findIndex(r => r.url === result.url)
    );
    
    return uniqueResults.slice(0, maxResults);
    
  } catch (error) {
    console.error("Web scraping search error:", error);
    
    // Last resort: return a search result that at least gives some guidance
    return [
      {
        title: `Search results for "${query}"`,
        url: `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
        snippet: `I was unable to fetch detailed search results for "${query}". Please try searching manually or check your internet connection. You can click this link to search directly.`,
        timestamp: new Date().toISOString()
      }
    ];
  }
}

// Bing search (often has good results and is more permissive than Google)
async function searchBing(query: string, maxResults: number) {
  try {
    const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=${maxResults}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
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
          timestamp: new Date().toISOString()
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
    // First get the search page
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`DuckDuckGo search failed: ${response.status}`);
    }
    
    const html = await response.text();
    const results = [];
    
    // Parse DuckDuckGo results
    const linkPattern = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g;
    const snippetPattern = /<a[^>]*class="result__snippet"[^>]*>([^<]*)<\/a>/g;
    
    const linkMatches = [...html.matchAll(linkPattern)];
    const snippetMatches = [...html.matchAll(snippetPattern)];
    
    for (let i = 0; i < Math.min(linkMatches.length, maxResults); i++) {
      const linkMatch = linkMatches[i];
      const snippetMatch = snippetMatches[i];
      
      if (linkMatch && linkMatch[1] && linkMatch[2]) {
        results.push({
          title: linkMatch[2].trim(),
          url: linkMatch[1],
          snippet: snippetMatch ? snippetMatch[1].trim() : "No description available",
          timestamp: new Date().toISOString()
        });
      }
    }
    
    return results;
    
  } catch (error) {
    console.error("DuckDuckGo scrape error:", error);
    return [];
  }
} 