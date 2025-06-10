import { NextRequest, NextResponse } from "next/server";

// API Route optimized for serverless environments (Netlify/Vercel)
// Timeouts are kept under 25 seconds due to serverless function limits
export async function POST(request: NextRequest) {
  let provider = "unknown"; // Declare in outer scope for error handling
  
  try {
    const requestBody = await request.json();
    const { messages, provider: requestProvider, apiKey, model, temperature, customModelName, webSearchEnabled } = requestBody;
    provider = requestProvider; // Assign to outer scope variable

    // Validate required inputs
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.error("Invalid messages:", messages);
      return NextResponse.json(
        { error: "Messages array is required and must not be empty" },
        { status: 400 }
      );
    }

    if (!provider || typeof provider !== 'string') {
      console.error("Invalid provider:", provider);
      return NextResponse.json(
        { error: "Valid provider is required" },
        { status: 400 }
      );
    }

    if (!apiKey || typeof apiKey !== 'string') {
      console.error("Invalid API key for provider:", provider);
      return NextResponse.json(
        { error: "Valid API key is required" },
        { status: 400 }
      );
    }

    console.log("API request validated successfully for provider:", provider);

    let response;
    let aiResponse = "";
    let searchResults = null;

    // Detect if this is a code generation request
    let isCodeRequest = false;
    try {
      const lastUserMessage = messages[messages.length - 1]?.content?.toLowerCase() || "";
      isCodeRequest = lastUserMessage.includes("html") || 
                     lastUserMessage.includes("css") || 
                     lastUserMessage.includes("javascript") || 
                     lastUserMessage.includes("js") ||
                     lastUserMessage.includes("code") ||
                     lastUserMessage.includes("function") ||
                     lastUserMessage.includes("component") ||
                     lastUserMessage.includes("website") ||
                     lastUserMessage.includes("app") ||
                     lastUserMessage.includes("build") ||
                     lastUserMessage.includes("create") ||
                     lastUserMessage.includes("develop") ||
                     lastUserMessage.includes("program") ||
                     lastUserMessage.includes("script") ||
                     lastUserMessage.includes("react") ||
                     lastUserMessage.includes("vue") ||
                     lastUserMessage.includes("angular") ||
                     lastUserMessage.includes("node") ||
                     lastUserMessage.includes("python") ||
                     lastUserMessage.includes("java") ||
                     lastUserMessage.includes("php") ||
                     lastUserMessage.includes("sql") ||
                     lastUserMessage.includes("<") ||
                     lastUserMessage.includes("```");

      console.log("Code request detected:", isCodeRequest, "for message:", lastUserMessage.substring(0, 100));
    } catch (error) {
      console.error("Error in code detection:", error);
      isCodeRequest = false; // Fallback to false if detection fails
    }

    // Optimize parameters for code generation
    const getOptimizedParams = (baseTimeout: number, baseTokens: number) => {
      try {
        if (isCodeRequest) {
          return {
            timeout: Math.min(baseTimeout + 5000, 28000), // Add 5 seconds for code, max 28s
            maxTokens: Math.min(baseTokens * 2, 6000), // Double tokens for code, max 6000
            temperature: 0.1 // Lower temperature for more focused code output
          };
        }
        return {
          timeout: baseTimeout,
          maxTokens: baseTokens,
          temperature: temperature || 0.7
        };
      } catch (error) {
        console.error("Error in parameter optimization:", error);
        // Fallback to safe defaults
        return {
          timeout: baseTimeout,
          maxTokens: baseTokens,
          temperature: temperature || 0.7
        };
      }
    };

    // Add code optimization instructions to messages
    const optimizeMessagesForCode = (messages: any[]) => {
      try {
        if (!isCodeRequest || !Array.isArray(messages) || messages.length === 0) {
          return messages;
        }
        
        const optimizedMessages = [...messages];
        const lastMessage = optimizedMessages[optimizedMessages.length - 1];
        
        if (lastMessage && lastMessage.role === "user" && lastMessage.content) {
          // Add code-focused instructions
          const codeInstructions = `

CODE GENERATION INSTRUCTIONS:
- Focus primarily on providing working, complete code
- Minimize explanatory text - let the code speak for itself
- Use comments within the code for necessary explanations
- Provide complete, functional examples that can be run immediately
- For HTML/CSS/JS: provide a complete working example
- For components: include all necessary imports and exports
- Keep descriptions brief and to the point
- Prioritize code quality and completeness over lengthy explanations

User Request: ${lastMessage.content}`;

          optimizedMessages[optimizedMessages.length - 1] = {
            ...lastMessage,
            content: codeInstructions
          };
        }
        
        return optimizedMessages;
      } catch (error) {
        console.error("Error in message optimization:", error);
        // Return original messages if optimization fails
        return messages;
      }
    };

    // Helper function to add timeout to fetch requests (optimized for serverless)
    const fetchWithTimeout = async (url: string, options: any, timeoutMs: number = 25000): Promise<Response> => {
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
          throw new Error(`Request timed out after ${timeoutMs / 1000} seconds. For large code generation, try breaking your request into smaller parts or use a simpler prompt.`);
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
          }, 20000); // 20 second timeout for web search

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
        const openaiParams = getOptimizedParams(25000, 3000);
        const openaiMessages = optimizeMessagesForCode(messages.map((m: any) => ({ role: m.role, content: m.content })));
        
        response = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model.includes("gpt-3.5") ? "gpt-3.5-turbo" : "gpt-4o",
            messages: openaiMessages,
            temperature: openaiParams.temperature,
            max_tokens: openaiParams.maxTokens,
            stream: false
          })
        }, openaiParams.timeout);

        if (!response.ok) {
          const errorData = await response.text();
          if (response.status === 504) {
            throw new Error(`OpenAI request timed out. Try breaking large code requests into smaller parts or use a simpler prompt.`);
          }
          throw new Error(`OpenAI is currently unavailable (${response.status}). Please try again in a moment.`);
        }

        const openaiData = await safeJsonParse(response, "OpenAI");
        aiResponse = cleanAIResponse(openaiData.choices[0]?.message?.content || "OpenAI didn't provide a response. Please try again.", "OpenAI");
        break;

      case "claude":
        const claudeParams = getOptimizedParams(25000, 4000);
        const claudeMessages = optimizeMessagesForCode(messages.map((m: any) => ({ role: m.role, content: m.content })));
        
        response = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: "claude-3-opus-20240229",
            max_tokens: claudeParams.maxTokens,
            temperature: claudeParams.temperature,
            messages: claudeMessages
          })
        }, claudeParams.timeout);

        if (!response.ok) {
          const errorData = await response.text();
          if (response.status === 504) {
            throw new Error(`Claude request timed out. Try breaking large code requests into smaller parts or use a simpler prompt.`);
          }
          throw new Error(`Claude is currently unavailable (${response.status}). Please try again in a moment.`);
        }

        const claudeData = await safeJsonParse(response, "Claude");
        aiResponse = cleanAIResponse(claudeData.content[0]?.text || "Claude didn't provide a response. Please try again.", "Claude");
        break;

      case "gemini":
        const geminiParams = getOptimizedParams(25000, 4096);
        const geminiMessages = optimizeMessagesForCode(messages.map((m: any) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }]
        })));
        
        // Use Gemini 2.5 Flash Preview (latest model)
        response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: geminiMessages,
            generationConfig: {
              temperature: geminiParams.temperature,
              maxOutputTokens: geminiParams.maxTokens,
              topP: 0.95,
              topK: 40
            }
          })
        }, geminiParams.timeout);

        if (!response.ok) {
          const errorData = await response.text();
          if (response.status === 504) {
            throw new Error(`Gemini request timed out. Try breaking large code requests into smaller parts or use a simpler prompt.`);
          }
          throw new Error(`Gemini 2.5 Flash is currently unavailable (${response.status}). Please try again in a moment.`);
        }

        const geminiData = await safeJsonParse(response, "Gemini 2.5 Flash");
        aiResponse = cleanAIResponse(geminiData.candidates[0]?.content?.parts[0]?.text || "Gemini 2.5 Flash didn't provide a response. Please try again.", "Gemini 2.5 Flash");
        break;

      case "deepseek":
        const deepseekParams = getOptimizedParams(25000, 3000);
        const deepseekMessages = optimizeMessagesForCode(messages.map((m: any) => ({ role: m.role, content: m.content })));
        
        response = await fetchWithTimeout("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: deepseekMessages,
            temperature: deepseekParams.temperature,
            max_tokens: deepseekParams.maxTokens,
            stream: false
          })
        }, deepseekParams.timeout);

        if (!response.ok) {
          const errorData = await response.text();
          if (response.status === 504) {
            throw new Error(`DeepSeek request timed out. Try breaking large code requests into smaller parts or use a simpler prompt.`);
          }
          throw new Error(`DeepSeek is currently unavailable (${response.status}). Please try again in a moment.`);
        }

        const deepseekData = await safeJsonParse(response, "DeepSeek");
        aiResponse = cleanAIResponse(deepseekData.choices[0]?.message?.content || "DeepSeek didn't provide a response. Please try again.", "DeepSeek");
        break;

      case "grok":
        const grokParams = getOptimizedParams(25000, 3000);
        const grokMessages = optimizeMessagesForCode(messages.map((m: any) => ({ role: m.role, content: m.content })));
        
        response = await fetchWithTimeout("https://api.x.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: "grok-beta",
            messages: grokMessages,
            temperature: grokParams.temperature,
            max_tokens: grokParams.maxTokens,
            stream: false
          })
        }, grokParams.timeout);

        if (!response.ok) {
          const errorData = await response.text();
          if (response.status === 504) {
            throw new Error(`Grok request timed out. Try breaking large code requests into smaller parts or use a simpler prompt.`);
          }
          throw new Error(`Grok is currently unavailable (${response.status}). Please try again in a moment.`);
        }

        const grokData = await safeJsonParse(response, "Grok");
        aiResponse = cleanAIResponse(grokData.choices[0]?.message?.content || "Grok didn't provide a response. Please try again.", "Grok");
        break;

      case "openrouter":
        const openrouterParams = getOptimizedParams(25000, 3000);
        const openrouterMessages = optimizeMessagesForCode(messages.map((m: any) => ({ role: m.role, content: m.content })));
        
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
            messages: openrouterMessages,
            temperature: openrouterParams.temperature,
            max_tokens: openrouterParams.maxTokens,
            stream: false
          })
        }, openrouterParams.timeout);

        if (!response.ok) {
          const errorData = await response.text();
          if (response.status === 504) {
            throw new Error(`OpenRouter request timed out. Try breaking large code requests into smaller parts or use a simpler prompt.`);
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
        }, 25000); // 25 second timeout for serverless compatibility

        if (!response.ok) {
          const errorData = await response.text();
          if (response.status === 504) {
            throw new Error(`VEO2 video generation timed out. Video generation requires more time than available in serverless environment. Please try a simpler prompt.`);
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
    
    // Provide more detailed error information
    let errorMessage = "Unknown error occurred";
    let statusCode = 500;
    
    if (error instanceof Error) {
      errorMessage = error.message;
      console.error("Error stack:", error.stack);
      
      // Check for specific error types
      if (error.message.includes("timed out")) {
        statusCode = 504;
      } else if (error.message.includes("API key") || error.message.includes("unauthorized")) {
        statusCode = 401;
      } else if (error.message.includes("required") || error.message.includes("invalid")) {
        statusCode = 400;
      }
    } else {
      console.error("Non-Error object thrown:", error);
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        timestamp: new Date().toISOString(),
        provider: provider || "unknown"
      },
      { status: statusCode }
    );
  }
}