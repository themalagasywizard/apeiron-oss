import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { messages, provider, apiKey, model, temperature, customModelName, webSearchEnabled } = await request.json();

    let response;
    let aiResponse = "";
    let searchResults = null;

    // Perform web search if enabled for compatible models (Gemini and Grok)
    if (webSearchEnabled && (provider === "gemini" || provider === "grok")) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.role === "user") {
        try {
          console.log("Performing web search for:", lastMessage.content);
          
          const searchResponse = await fetch(`${new URL(request.url).origin}/api/web-search`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: lastMessage.content,
              maxResults: 5
            })
          });

          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            searchResults = searchData.results;
            
            // Enhance the user's message with search context
            const searchContext = searchResults.map((result: any, index: number) => 
              `[${index + 1}] Title: ${result.title}
URL: ${result.url}
Content: ${result.snippet}`
            ).join('\n\n');
            
            const enhancedContent = `User Query: ${lastMessage.content}

REAL-TIME WEB SEARCH RESULTS (Use this information to answer the query):
${searchContext}

INSTRUCTIONS:
- Base your response ONLY on the web search results provided above
- Include specific information from the search results 
- Cite sources using the format [1], [2], etc. referring to the numbered sources above
- Provide clickable links in your response using markdown format [Link Text](URL)
- If the search results don't contain enough information to fully answer the query, say so explicitly
- Do NOT provide generic information not found in the search results

Please provide a comprehensive response using the above search results.`;

            // Update the last message with search context
            messages[messages.length - 1] = {
              ...lastMessage,
              content: enhancedContent
            };
          } else {
            console.error("Web search API returned error:", await searchResponse.text());
          }
        } catch (searchError) {
          console.error("Web search failed:", searchError);
          // Continue without search results
        }
      }
    }

    // Helper function to safely parse JSON with fallback
    const safeJsonParse = async (response: Response, providerName: string) => {
      const text = await response.text();
      
      // Check for empty response
      if (!text || text.trim() === '') {
        console.error(`${providerName} returned empty response`);
        throw new Error(`${providerName} returned an empty response. This usually indicates a server error. Please try again.`);
      }
      
      // Check for HTML error pages (common with 5xx errors)
      if (text.trim().startsWith('<')) {
        console.error(`${providerName} returned HTML instead of JSON:`, text.substring(0, 200));
        throw new Error(`${providerName} returned an error page instead of a valid response. Please try again later.`);
      }
      
      // Try to parse JSON
      try {
        const parsed = JSON.parse(text);
        
        // Additional validation for known API response formats
        if (providerName === "OpenAI" && !parsed.choices) {
          console.error(`${providerName} returned invalid format:`, parsed);
          throw new Error(`${providerName} returned an unexpected response format. Please try again.`);
        }
        
        if (providerName === "Claude" && !parsed.content) {
          console.error(`${providerName} returned invalid format:`, parsed);
          throw new Error(`${providerName} returned an unexpected response format. Please try again.`);
        }
        
        if (providerName === "Gemini 2.5 Flash" && !parsed.candidates) {
          console.error(`${providerName} returned invalid format:`, parsed);
          throw new Error(`${providerName} returned an unexpected response format. Please try again.`);
        }
        
        return parsed;
        
      } catch (parseError) {
        console.error(`${providerName} JSON parse error:`, parseError);
        console.error(`${providerName} response text (first 500 chars):`, text.substring(0, 500));
        
        // More specific error messages based on the parse error
        if (parseError instanceof SyntaxError) {
          if (parseError.message.includes('Unexpected end of JSON input')) {
            throw new Error(`${providerName} response was cut off. This usually indicates a network issue. Please try again.`);
          } else if (parseError.message.includes('Unexpected token')) {
            throw new Error(`${providerName} returned malformed data. This may be a temporary server issue. Please try again.`);
          }
        }
        
        throw new Error(`${providerName} returned an invalid response format. Please try again later.`);
      }
    };

    switch (provider) {
      case "openai":
        response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model.includes("gpt-3.5") ? "gpt-3.5-turbo" : "gpt-4o",
            messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
            temperature: temperature || 0.7,
            stream: false
          })
        });

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`OpenAI is currently unavailable (${response.status}). Please try again in a moment.`);
        }

        const openaiData = await safeJsonParse(response, "OpenAI");
        aiResponse = openaiData.choices[0]?.message?.content || "OpenAI didn't provide a response. Please try again.";
        break;

      case "claude":
        response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: "claude-3-opus-20240229",
            max_tokens: 4000,
            temperature: temperature || 0.7,
            messages: messages.map((m: any) => ({ role: m.role, content: m.content }))
          })
        });

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`Claude is currently unavailable (${response.status}). Please try again in a moment.`);
        }

        const claudeData = await safeJsonParse(response, "Claude");
        aiResponse = claudeData.content[0]?.text || "Claude didn't provide a response. Please try again.";
        break;

      case "gemini":
        // Use Gemini 2.5 Flash Preview (latest model)
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: messages.map((m: any) => ({
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: m.content }]
            })),
            generationConfig: {
              temperature: temperature || 0.7,
              maxOutputTokens: 8192,
              topP: 0.95,
              topK: 40
            }
          })
        });

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`Gemini 2.5 Flash is currently unavailable (${response.status}). Please try again in a moment.`);
        }

        const geminiData = await safeJsonParse(response, "Gemini 2.5 Flash");
        aiResponse = geminiData.candidates[0]?.content?.parts[0]?.text || "Gemini 2.5 Flash didn't provide a response. Please try again.";
        break;

      case "deepseek":
        response = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
            temperature: temperature || 0.7,
            stream: false
          })
        });

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`DeepSeek is currently unavailable (${response.status}). Please try again in a moment.`);
        }

        const deepseekData = await safeJsonParse(response, "DeepSeek");
        aiResponse = deepseekData.choices[0]?.message?.content || "DeepSeek didn't provide a response. Please try again.";
        break;

      case "grok":
        response = await fetch("https://api.x.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: "grok-beta",
            messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
            temperature: temperature || 0.7,
            stream: false
          })
        });

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`Grok is currently unavailable (${response.status}). Please try again in a moment.`);
        }

        const grokData = await safeJsonParse(response, "Grok");
        aiResponse = grokData.choices[0]?.message?.content || "Grok didn't provide a response. Please try again.";
        break;

      case "openrouter":
        response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": request.headers.get("referer") || "",
            "X-Title": "T3 Chat"
          },
          body: JSON.stringify({
            model: customModelName || "meta-llama/llama-3.1-8b-instruct:free",
            messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
            temperature: temperature || 0.7,
            stream: false
          })
        });

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`OpenRouter is currently unavailable (${response.status}). Please try again in a moment.`);
        }

        const openrouterData = await safeJsonParse(response, "OpenRouter");
        aiResponse = openrouterData.choices[0]?.message?.content || "OpenRouter didn't provide a response. Please try again.";
        break;

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    return NextResponse.json({ 
      response: aiResponse,
      model: model,
      provider: provider,
      searchResults: searchResults,
      searchEnabled: webSearchEnabled && (provider === "gemini" || provider === "grok")
    });

  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error occurred" },
      { status: 500 }
    );
  }
} 