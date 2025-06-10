import { NextRequest, NextResponse } from "next/server";

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
      console.log("SERP_API_KEY not found, using DuckDuckGo fallback");
      return await performDuckDuckGoSearch(query, maxResults);
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
    // Fallback to DuckDuckGo if SerpAPI fails
    return await performDuckDuckGoSearch(query, maxResults);
  }
}

// Fallback search using DuckDuckGo Instant Answer API
async function performDuckDuckGoSearch(query: string, maxResults: number) {
  try {
    console.log("Using DuckDuckGo fallback search");
    
    // DuckDuckGo Instant Answer API
    const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`);
    
    if (!response.ok) {
      throw new Error(`DuckDuckGo request failed: ${response.status}`);
    }

    const data = await response.json();
    const results = [];

    // Add abstract/definition if available
    if (data.Abstract && data.Abstract.trim()) {
      results.push({
        title: data.Heading || `About ${query}`,
        url: data.AbstractURL || "#",
        snippet: data.Abstract,
        timestamp: new Date().toISOString()
      });
    }

    // Add related topics
    if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
      for (const topic of data.RelatedTopics.slice(0, maxResults - results.length)) {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(' - ')[0] || "Related topic",
            url: topic.FirstURL,
            snippet: topic.Text,
            timestamp: new Date().toISOString()
          });
        }
      }
    }

    // If we still don't have enough results, add some constructed search URLs
    if (results.length < 2) {
      const fallbackResults = [
        {
          title: `Search results for "${query}"`,
          url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
          snippet: `Search results and information about ${query} from DuckDuckGo.`,
          timestamp: new Date().toISOString()
        },
        {
          title: `Wikipedia: ${query}`,
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(query.replace(/\s+/g, '_'))}`,
          snippet: `Wikipedia article and encyclopedia information about ${query}.`,
          timestamp: new Date().toISOString()
        }
      ];
      
      results.push(...fallbackResults.slice(0, maxResults - results.length));
    }

    return results.slice(0, maxResults);
    
  } catch (error) {
    console.error("DuckDuckGo search error:", error);
    
    // Last resort: return constructed results
    return [
      {
        title: `Search: ${query}`,
        url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
        snippet: `Unable to fetch live search results. Click to search for "${query}" on DuckDuckGo.`,
        timestamp: new Date().toISOString()
      }
    ];
  }
} 