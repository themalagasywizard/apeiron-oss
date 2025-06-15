import { NextRequest, NextResponse } from "next/server";

// API Route optimized for serverless environments (Netlify/Vercel)
// Timeouts are kept under 25 seconds due to serverless function limits
export async function POST(request: NextRequest) {
  let provider = "unknown"; // Declare in outer scope for error handling
  
  // Emergency timeout - kill the entire function after 35 seconds (to accommodate code generation)
  const emergencyTimeout = setTimeout(() => {
    console.error("Emergency timeout hit - function taking too long");
  }, 35000);
  
  try {
    const requestBody = await request.json();
    const { messages, provider: requestProvider, apiKey, model, temperature, customModelName, webSearchEnabled, codeGenerationEnabled } = requestBody;
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

    let response;
    let aiResponse = "";
    let searchResults = null;

    // Helper function to add timeout to fetch requests
    const fetchWithTimeout = async (url: string, options: any, timeoutMs: number = 18000): Promise<Response> => {
      // Allow longer timeouts for edge functions (up to 90s), but cap regular requests at 30s
      const isEdgeFunction = url.includes('/.netlify/edge-functions/');
      const maxTimeout = isEdgeFunction ? 90000 : 30000;
      const safeTimeout = Math.min(timeoutMs, maxTimeout);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), safeTimeout);

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
          const errorMsg = isEdgeFunction 
            ? `Edge function timed out after ${safeTimeout / 1000} seconds. Try a shorter request.`
            : `Request timed out after ${safeTimeout / 1000} seconds. Serverless functions have strict time limits. Try a shorter request.`;
          throw new Error(errorMsg);
        }
        throw error;
      }
    };

    // Detect if this is a code generation request
    let isCodeRequest = false;
    try {
      // First check if code generation is explicitly enabled
      if (codeGenerationEnabled) {
        isCodeRequest = true;
      } else {
        // Fallback to content-based detection
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
                       lastUserMessage.includes("landing page") ||
                       lastUserMessage.includes("make me") ||
                       lastUserMessage.includes("<") ||
                       lastUserMessage.includes("```");
      }
    } catch (error) {
      console.error("Error in code detection:", error);
      isCodeRequest = false; // Fallback to false if detection fails
    }

    // In production (Netlify), route code generation requests to Edge Function
    const isProduction = process.env.NODE_ENV === 'production' || process.env.NETLIFY === 'true';
    if (isCodeRequest && isProduction) {
      try {
        console.log('Routing code generation request to edge function in production');
        const edgeFunctionUrl = `${new URL(request.url).origin}/api/generate-code`;
        
        const edgeResponse = await fetchWithTimeout(edgeFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages,
            provider,
            apiKey,
            model,
            temperature,
            customModelName
          })
        }, 35000); // 35 second timeout for edge function to prevent 504s

        if (!edgeResponse.ok) {
          const errorText = await edgeResponse.text().catch(() => 'Unknown error');
          throw new Error(`Edge function error (${edgeResponse.status}): ${errorText}`);
        }

        const edgeResult = await edgeResponse.json();
        clearTimeout(emergencyTimeout);
        return NextResponse.json(edgeResult);
        
      } catch (edgeError) {
        console.error('Edge function failed, falling back to serverless:', edgeError);
        // Continue with regular serverless processing as fallback
      }
    } else if (isCodeRequest && !isProduction) {
      console.log('Code generation request in development mode - using serverless function');
    }

    // Optimize parameters for code generation
    const getOptimizedParams = (baseTimeout: number, baseTokens: number) => {
      try {
        if (isCodeRequest || codeGenerationEnabled) {
          return {
            timeout: Math.min(baseTimeout + 10000, 30000), // Add 10 seconds for code, max 30s
            maxTokens: Math.min(baseTokens * 2, 8000), // 2x tokens for code, max 8000
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

    // Clean and optimize messages for API requests
    const optimizeMessagesForCode = (messages: any[]) => {
      try {
        if (!Array.isArray(messages) || messages.length === 0) {
          return messages;
        }
        
        // Filter and clean messages
        const cleanedMessages = messages
          .filter((m: any) => {
            // Remove messages with empty or invalid content
            return m && m.role && m.content && typeof m.content === 'string' && m.content.trim().length > 0;
          })
          .map((m: any) => ({
            role: m.role,
            content: m.content.trim()
          }));
        
        // Ensure we have at least one message
        if (cleanedMessages.length === 0) {
          return [{ role: "user", content: "Hello" }];
        }
        
        // Add code generation instructions if this is a code request
        if ((isCodeRequest || codeGenerationEnabled) && cleanedMessages.length > 0) {
          const lastMessage = cleanedMessages[cleanedMessages.length - 1];
          if (lastMessage.role === "user") {
            lastMessage.content = `${lastMessage.content}

IMPORTANT CODE GENERATION INSTRUCTIONS:
- Provide complete, working code that can be run immediately
- Include all necessary imports, dependencies, and setup
- Use modern best practices and clean, readable code
- Add helpful comments explaining key functionality
- If creating a web page/app, make it visually appealing with good UX
- Ensure the code is production-ready and follows security best practices`;
          }
        }
        
        return cleanedMessages;
      } catch (error) {
        console.error("Error in message optimization:", error);
        // Return a safe fallback
        return [{ role: "user", content: "Hello" }];
      }
    };

    // Perform web search if enabled for compatible models (Gemini and Grok)
    if (webSearchEnabled && (provider === "gemini" || provider === "grok")) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.role === "user") {
        try {
          
          const searchResponse = await fetchWithTimeout(`${new URL(request.url).origin}/api/web-search`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: lastMessage.content,
              maxResults: 5
            })
          }, 15000); // 15 second timeout for web search in serverless

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
        const openaiParams = getOptimizedParams(15000, 2500);
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
            throw new Error(`OpenAI request timed out. Serverless time limit reached. Try a shorter request.`);
          }
          throw new Error(`OpenAI is currently unavailable (${response.status}). Please try again in a moment.`);
        }

        const openaiData = await safeJsonParse(response, "OpenAI");
        aiResponse = cleanAIResponse(openaiData.choices[0]?.message?.content || "OpenAI didn't provide a response. Please try again.", "OpenAI");
        break;

      case "claude":
        const claudeParams = getOptimizedParams(15000, 3000);
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
            throw new Error(`Claude request timed out. Serverless time limit reached. Try a shorter request.`);
          }
          throw new Error(`Claude is currently unavailable (${response.status}). Please try again in a moment.`);
        }

        const claudeData = await safeJsonParse(response, "Claude");
        aiResponse = cleanAIResponse(claudeData.content[0]?.text || "Claude didn't provide a response. Please try again.", "Claude");
        break;

      case "gemini":
        const geminiParams = getOptimizedParams(15000, 3000);
        
        // Clean messages first, then convert to Gemini format
        const cleanedGeminiMessages = optimizeMessagesForCode(messages);
        const geminiMessages = cleanedGeminiMessages.map((m: any) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }]
        }));
        

        
        // Use correct Gemini 2.5 model names
        let geminiModel = "gemini-1.5-pro"; // Default fallback
        if (model.includes("2.5-flash")) {
          geminiModel = "gemini-2.5-flash-preview-05-20"; // Correct 2.5 Flash model name
        } else if (model.includes("2.5-pro")) {
          geminiModel = "gemini-2.5-pro-preview-06-05"; // Correct 2.5 Pro model name
        }
        
        response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`, {
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
          console.error("Gemini API error:", response.status, errorData);
          if (response.status === 504) {
            throw new Error(`Gemini request timed out. Serverless time limit reached. Try a shorter request.`);
          }
          throw new Error(`Gemini API error (${response.status}): ${errorData}`);
        }

        const geminiData = await safeJsonParse(response, "Gemini");
        aiResponse = cleanAIResponse(geminiData.candidates[0]?.content?.parts[0]?.text || "Gemini didn't provide a response. Please try again.", "Gemini");
        break;

      case "deepseek":
        const deepseekParams = getOptimizedParams(25000, 1500); // Increased timeout to 25 seconds, further reduced max tokens
        const deepseekMessages = optimizeMessagesForCode(messages.map((m: any) => ({ role: m.role, content: m.content })));
        
        // Use the specific model passed in (should be deepseek-v3), fallback to deepseek-chat
        const deepseekModel = model === "deepseek-v3" ? "deepseek-v3" : "deepseek-chat";
        
        try {
          response = await fetchWithTimeout("https://api.deepseek.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: deepseekModel,
              messages: deepseekMessages,
              temperature: Math.min(deepseekParams.temperature, 0.3), // Lower temperature for more consistent responses
              max_tokens: deepseekParams.maxTokens,
              stream: false
            })
          }, deepseekParams.timeout);

          if (!response.ok) {
            const errorData = await response.text();
            console.error("DeepSeek API error:", response.status, errorData);
            
            if (response.status === 504 || response.status === 524) {
              throw new Error(`DeepSeek is experiencing heavy load and timing out. Please try again in a few moments, or try a shorter request.`);
            } else if (response.status === 429) {
              throw new Error(`DeepSeek rate limit exceeded. Please wait a moment before trying again.`);
            } else if (response.status === 503) {
              throw new Error(`DeepSeek service is temporarily unavailable. Please try again in a few minutes.`);
            } else {
              throw new Error(`DeepSeek is currently unavailable (${response.status}). Please try again in a moment.`);
            }
          }

          const deepseekData = await safeJsonParse(response, "DeepSeek");
          aiResponse = cleanAIResponse(deepseekData.choices[0]?.message?.content || "DeepSeek didn't provide a response. Please try again.", "DeepSeek");
          
        } catch (deepseekError) {
          console.error("DeepSeek error:", deepseekError);
          
          // If deepseek-v3 fails, try fallback to deepseek-chat
          if (deepseekModel === "deepseek-v3") {
            console.log("Retrying with deepseek-chat model...");
            
            try {
              response = await fetchWithTimeout("https://api.deepseek.com/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                  model: "deepseek-chat",
                  messages: deepseekMessages.slice(-3), // Only use last 3 messages for fallback
                  temperature: 0.2,
                  max_tokens: 1000, // Further reduced for fallback
                  stream: false
                })
              }, 20000); // 20 second timeout for fallback

              if (!response.ok) {
                throw deepseekError; // Throw original error if fallback also fails
              }

              const fallbackData = await safeJsonParse(response, "DeepSeek");
              aiResponse = cleanAIResponse(fallbackData.choices[0]?.message?.content || "DeepSeek didn't provide a response. Please try again.", "DeepSeek");
              
            } catch (fallbackError) {
              throw deepseekError; // Throw original error
            }
          } else {
            throw deepseekError;
          }
        }
        break;

      case "grok":
        const grokParams = getOptimizedParams(15000, 2500);
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
            throw new Error(`Grok request timed out. Serverless time limit reached. Try a shorter request.`);
          }
          throw new Error(`Grok is currently unavailable (${response.status}). Please try again in a moment.`);
        }

        const grokData = await safeJsonParse(response, "Grok");
        aiResponse = cleanAIResponse(grokData.choices[0]?.message?.content || "Grok didn't provide a response. Please try again.", "Grok");
        break;

      case "openrouter":
        const openrouterParams = getOptimizedParams(15000, 2500);
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
            throw new Error(`OpenRouter request timed out. Serverless time limit reached. Try a shorter request.`);
          }
          throw new Error(`OpenRouter is currently unavailable (${response.status}). Please try again in a moment.`);
        }

        const openrouterData = await safeJsonParse(response, "OpenRouter");
        aiResponse = cleanAIResponse(openrouterData.choices[0]?.message?.content || "OpenRouter didn't provide a response. Please try again.", "OpenRouter");
        break;

      case "mistral":
        const mistralParams = getOptimizedParams(15000, 2500);
        const mistralMessages = optimizeMessagesForCode(messages.map((m: any) => ({ role: m.role, content: m.content })));
        

        
        // Map model names to Mistral API model names
        let mistralModel = "mistral-large-latest";
        if (model.includes("large")) mistralModel = "mistral-large-latest";
        else if (model.includes("medium")) mistralModel = "mistral-medium-latest";
        else if (model.includes("small")) mistralModel = "mistral-small-latest";
        else if (model.includes("codestral")) mistralModel = "codestral-latest";
        
        
        
        response = await fetchWithTimeout("https://api.mistral.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: mistralModel,
            messages: mistralMessages,
            temperature: mistralParams.temperature,
            max_tokens: mistralParams.maxTokens,
            stream: false
          })
        }, mistralParams.timeout);

        if (!response.ok) {
          const errorData = await response.text();
          console.error("Mistral API error:", response.status, errorData);
          if (response.status === 504) {
            throw new Error(`Mistral request timed out. Serverless time limit reached. Try a shorter request.`);
          }
          throw new Error(`Mistral API error (${response.status}): ${errorData}`);
        }

        const mistralData = await safeJsonParse(response, "Mistral");
        aiResponse = cleanAIResponse(mistralData.choices[0]?.message?.content || "Mistral didn't provide a response. Please try again.", "Mistral");
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
        }, 15000); // 15 second timeout for serverless compatibility

        if (!response.ok) {
          const errorData = await response.text();
          if (response.status === 504) {
            throw new Error(`VEO2 video generation timed out. Video generation requires more time than serverless functions allow. Please try a simpler prompt.`);
          }
          throw new Error(`VEO2 is currently unavailable (${response.status}). Please try again in a moment.`);
        }

        const veo2Data = await safeJsonParse(response, "VEO2");
        aiResponse = cleanAIResponse(veo2Data.data?.message || "Video generation initiated with VEO2", "VEO2");
        break;

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    clearTimeout(emergencyTimeout);
    return NextResponse.json({ 
      content: aiResponse,
      response: aiResponse, // Keep both for compatibility
      model: model,
      provider: provider,
      searchResults: searchResults,
      searchEnabled: webSearchEnabled && (provider === "gemini" || provider === "grok")
    });

  } catch (error) {
    clearTimeout(emergencyTimeout);
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