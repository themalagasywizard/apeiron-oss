import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { messages, provider, apiKey, model, temperature, customModelName, webSearchEnabled } = await request.json();

    let response;
    let aiResponse = "";
    let searchResults = null;

    // Helper function to add timeout to fetch requests
    const fetchWithTimeout = async (url: string, options: any, timeoutMs: number = 120000): Promise<Response> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`Request timed out after ${timeoutMs / 1000} seconds. This often happens with large code generation requests. Please try with a shorter prompt or retry.`);
        }
        throw error;
      }
    };

    // Perform web search if enabled for compatible models (Gemini and Grok)
    if (webSearchEnabled && (provider === "gemini" || provider === "grok")) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.role === "user") {
        try {
          console.log("Performing web search for:", lastMessage.content);
          
          const searchResponse = await fetchWithTimeout(`${new URL(request.url).origin}/api/web-search`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: lastMessage.content,
              maxResults: 5
            })
          }, 30000); // 30 second timeout for web search

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
      if (!text || text.trim() === '') {
        throw new Error(`${providerName} returned an empty response. Please try again.`);
      }
      
      try {
        const parsed = JSON.parse(text);
        return parsed;
      } catch (parseError) {
        console.error(`${providerName} JSON parse error:`, parseError);
        console.error(`${providerName} response text (first 500 chars):`, text.substring(0, 500));
        
        // Try to extract any meaningful content from the response
        if (text.includes('"content"') || text.includes('"text"') || text.includes('"message"')) {
          // This looks like it might be a partial JSON response
          throw new Error(`${providerName} returned a partial response. This often happens with very long code outputs. Please try with a smaller request or retry.`);
        }
        
        throw new Error(`${providerName} returned an invalid response format. Please try again.`);
      }
    };

    // Helper function to validate and clean AI responses, especially for code
    const cleanAIResponse = (response: string, providerName: string): string => {
      if (!response || typeof response !== 'string') {
        throw new Error(`${providerName} returned an invalid response type. Please try again.`);
      }
      
      // Ensure the response is properly terminated (not cut off)
      const trimmed = response.trim();
      if (trimmed.length === 0) {
        throw new Error(`${providerName} returned an empty response. Please try again.`);
      }
      
      return trimmed;
    };

    switch (provider) {
      case "openai":
        response = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
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
        }, 120000); // 2 minute timeout

        if (!response.ok) {
          const errorData = await response.text();
          if (response.status === 504) {
            throw new Error(`OpenAI request timed out. This often happens with complex code generation. Please try with a shorter request or retry.`);
          }
          throw new Error(`OpenAI is currently unavailable (${response.status}). Please try again in a moment.`);
        }

        const openaiData = await safeJsonParse(response, "OpenAI");
        aiResponse = cleanAIResponse(openaiData.choices[0]?.message?.content || "OpenAI didn't provide a response. Please try again.", "OpenAI");
        break;

      case "claude":
        response = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
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
        }, 120000); // 2 minute timeout

        if (!response.ok) {
          const errorData = await response.text();
          if (response.status === 504) {
            throw new Error(`Claude request timed out. This often happens with complex code generation. Please try with a shorter request or retry.`);
          }
          throw new Error(`Claude is currently unavailable (${response.status}). Please try again in a moment.`);
        }

        const claudeData = await safeJsonParse(response, "Claude");
        aiResponse = cleanAIResponse(claudeData.content[0]?.text || "Claude didn't provide a response. Please try again.", "Claude");
        break;

      case "gemini":
        // Use Gemini 2.5 Flash Preview (latest model)
        response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`, {
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
        }, 120000); // 2 minute timeout

        if (!response.ok) {
          const errorData = await response.text();
          if (response.status === 504) {
            throw new Error(`Gemini request timed out. This often happens with complex code generation. Please try with a shorter request or retry.`);
          }
          throw new Error(`Gemini 2.5 Flash is currently unavailable (${response.status}). Please try again in a moment.`);
        }

        const geminiData = await safeJsonParse(response, "Gemini 2.5 Flash");
        aiResponse = cleanAIResponse(geminiData.candidates[0]?.content?.parts[0]?.text || "Gemini 2.5 Flash didn't provide a response. Please try again.", "Gemini 2.5 Flash");
        break;

      case "deepseek":
        response = await fetchWithTimeout("https://api.deepseek.com/v1/chat/completions", {
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
        }, 120000); // 2 minute timeout

        if (!response.ok) {
          const errorData = await response.text();
          if (response.status === 504) {
            throw new Error(`DeepSeek request timed out. This often happens with complex code generation. Please try with a shorter request or retry.`);
          }
          throw new Error(`DeepSeek is currently unavailable (${response.status}). Please try again in a moment.`);
        }

        const deepseekData = await safeJsonParse(response, "DeepSeek");
        aiResponse = cleanAIResponse(deepseekData.choices[0]?.message?.content || "DeepSeek didn't provide a response. Please try again.", "DeepSeek");
        break;

      case "grok":
        response = await fetchWithTimeout("https://api.x.ai/v1/chat/completions", {
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
        }, 120000); // 2 minute timeout

        if (!response.ok) {
          const errorData = await response.text();
          if (response.status === 504) {
            throw new Error(`Grok request timed out. This often happens with complex code generation. Please try with a shorter request or retry.`);
          }
          throw new Error(`Grok is currently unavailable (${response.status}). Please try again in a moment.`);
        }

        const grokData = await safeJsonParse(response, "Grok");
        aiResponse = cleanAIResponse(grokData.choices[0]?.message?.content || "Grok didn't provide a response. Please try again.", "Grok");
        break;

      case "openrouter":
        response = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
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
        }, 120000); // 2 minute timeout

        if (!response.ok) {
          const errorData = await response.text();
          if (response.status === 504) {
            throw new Error(`OpenRouter request timed out. This often happens with complex code generation. Please try with a shorter request or retry.`);
          }
          throw new Error(`OpenRouter is currently unavailable (${response.status}). Please try again in a moment.`);
        }

        const openrouterData = await safeJsonParse(response, "OpenRouter");
        aiResponse = cleanAIResponse(openrouterData.choices[0]?.message?.content || "OpenRouter didn't provide a response. Please try again.", "OpenRouter");
        break;

      case "veo2":
        // VEO2 video generation using dedicated endpoint
        const prompt = messages[messages.length - 1]?.content || "";
        
        // Construct the VEO2 endpoint URL properly
        const baseUrl = new URL(request.url).origin;
        const veo2Url = `${baseUrl}/api/veo2`;
        
        response = await fetchWithTimeout(veo2Url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            prompt: prompt,
            apiKey: apiKey,
            duration: 8, // Use number instead of string
            aspectRatio: "16:9"
          })
        }, 180000); // 3 minute timeout for video generation

        if (!response.ok) {
          const errorData = await response.text();
          if (response.status === 504) {
            throw new Error(`VEO2 video generation timed out. Video generation can take several minutes. Please try again or with a shorter prompt.`);
          }
          throw new Error(`VEO2 is currently unavailable (${response.status}). Please try again in a moment.`);
        }

        const veo2Data = await safeJsonParse(response, "VEO2");
        aiResponse = cleanAIResponse(veo2Data.data?.message || "Video generation initiated with VEO2", "VEO2");
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