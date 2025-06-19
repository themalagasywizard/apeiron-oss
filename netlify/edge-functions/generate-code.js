// Netlify Edge Function for AI Code Generation
// Runs on Deno runtime at the network edge with higher execution time limits

export default async (request, context) => {
  // Add CORS headers for all responses
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Only allow POST requests
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders
    });
  }

  let requestBody;
  
  try {
    // Parse request body with error handling
    const bodyText = await request.text();
    if (!bodyText) {
      return new Response(JSON.stringify({ error: 'Empty request body' }), {
        status: 400,
        headers: corsHeaders
      });
    }
    
    try {
      requestBody = JSON.parse(bodyText);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return new Response(JSON.stringify({ 
        error: 'Invalid JSON in request body',
        details: parseError.message,
        receivedBody: bodyText.substring(0, 100) + '...' // Log first 100 chars for debugging
      }), {
        status: 400,
        headers: corsHeaders
      });
    }
  } catch (error) {
    console.error('Request body read error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to read request body',
      details: error.message 
    }), {
      status: 400,
      headers: corsHeaders
    });
  }

  try {
    const { messages, provider, apiKey, model, temperature = 0.1, customModelName } = requestBody;

    // Validate required inputs with detailed error messages
    if (!messages) {
      return new Response(JSON.stringify({ error: 'Messages array is required' }), {
        status: 400,
        headers: corsHeaders
      });
    }

    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ 
        error: 'Messages must be an array',
        received: typeof messages
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Messages array must not be empty' }), {
        status: 400,
        headers: corsHeaders
      });
    }

    if (!provider || typeof provider !== 'string') {
      return new Response(JSON.stringify({ 
        error: 'Valid provider is required',
        received: provider
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    if (!apiKey || typeof apiKey !== 'string') {
      return new Response(JSON.stringify({ error: 'Valid API key is required' }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Log request info for debugging
    console.log(`Edge Function: Code generation request for provider: ${provider}`);
    console.log('Request details:', {
      provider,
      model,
      messagesCount: messages.length,
      hasApiKey: !!apiKey
    });

    // Optimized parameters for edge function environment
    const codeParams = {
      maxTokens: 2000, // Reduced to prevent timeouts
      temperature: temperature || 0.1,
      timeout: 25000  // 25 second timeout (Netlify limit is 30s)
    };

    // Optimize messages for code generation
    const optimizeMessagesForCode = (messages) => {
      try {
        const optimizedMessages = [...messages];
        const lastMessage = optimizedMessages[optimizedMessages.length - 1];
        
        if (lastMessage && lastMessage.role === "user" && lastMessage.content) {
          const codeInstructions = `Generate concise, production-ready code for: "${lastMessage.content}"
Key requirements:
- Working code with imports
- Modern practices
- Clear comments
- Security focused`;

          optimizedMessages[optimizedMessages.length - 1] = {
            ...lastMessage,
            content: codeInstructions
          };
        }
        
        return optimizedMessages;
      } catch (error) {
        console.error('Message optimization error:', error);
        return messages;
      }
    };

    const codeOptimizedMessages = optimizeMessagesForCode(messages);

    // Fetch with timeout and automatic retry
    const fetchWithTimeout = async (url, options, timeoutMs = 25000) => {
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
        console.error('Fetch error:', error);
        
        if (error.name === 'AbortError') {
          throw new Error(`Request timed out after ${timeoutMs / 1000} seconds`);
        }
        throw error;
      }
    };

    let response;
    let aiResponse = "";

    // Provider-specific handling with better error messages
    switch (provider.toLowerCase()) {
      case "openai":
        try {
          response = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: model || "gpt-3.5-turbo",
              messages: codeOptimizedMessages,
              temperature: codeParams.temperature,
              max_tokens: codeParams.maxTokens,
              stream: false
            })
          }, codeParams.timeout);

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
          }

          const openaiData = await response.json();
          aiResponse = openaiData.choices?.[0]?.message?.content || "No response generated";
        } catch (error) {
          console.error('OpenAI API error:', error);
          throw new Error(`OpenAI API error: ${error.message}`);
        }
        break;

      case "claude":
        try {
          let claudeModel = "claude-3-sonnet-20240229";
          if (model?.includes("haiku")) {
            claudeModel = "claude-3-haiku-20240229";
          } else if (model?.includes("opus")) {
            claudeModel = "claude-3-opus-20240229";
          }

          response = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
              model: claudeModel,
              max_tokens: codeParams.maxTokens,
              temperature: codeParams.temperature,
              messages: codeOptimizedMessages
            })
          }, codeParams.timeout);

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Claude API error (${response.status}): ${errorText}`);
          }

          const claudeData = await response.json();
          aiResponse = claudeData.content || "No response generated";
        } catch (error) {
          console.error('Claude API error:', error);
          throw new Error(`Claude API error: ${error.message}`);
        }
        break;

      case "gemini":
        // Use the correct Gemini model based on the request
        let geminiModel = "gemini-1.5-pro"; // Default fallback
        if (model && model.includes("2.5-flash")) {
          geminiModel = "gemini-2.5-flash-preview-05-20";
        } else if (model && model.includes("2.5-pro")) {
          geminiModel = "gemini-2.5-pro-preview-06-05";
        } else if (model && model.includes("1.5-pro")) {
          geminiModel = "gemini-1.5-pro";
        }

        response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: codeOptimizedMessages.map(m => ({
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: m.content }]
            })),
            generationConfig: {
              temperature: codeParams.temperature,
              maxOutputTokens: codeParams.maxTokens,
              topP: 0.95,
              topK: 40
            }
          })
        }, codeParams.timeout);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Gemini API error (${response.status}): ${errorText}`);
        }

        const geminiData = await response.json();
        aiResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated";
        break;

      case "deepseek":
        // Use the specific model passed in (should be deepseek-v3), max timeout for code generation
        let deepseekModel = model === "deepseek-v3" ? "deepseek-v3" : "deepseek-chat";
        let deepseekResponse;
        
        // Enhanced parameters for DeepSeek V3 code generation
        const deepseekCodeParams = {
          maxTokens: 8000, // Increased for code generation
          temperature: 0.1, // Very low for consistent code
          timeout: 120000  // 2 minutes maximum for Edge Function
        };
        
        try {
          deepseekResponse = await fetchWithTimeout("https://api.deepseek.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: deepseekModel,
              messages: codeOptimizedMessages.map(m => ({ role: m.role, content: m.content })),
              temperature: deepseekCodeParams.temperature,
              max_tokens: deepseekCodeParams.maxTokens,
              stream: false
            })
          }, deepseekCodeParams.timeout);

          if (!deepseekResponse.ok) {
            const errorText = await deepseekResponse.text();
            console.error(`DeepSeek ${deepseekModel} failed:`, deepseekResponse.status, errorText);
            
            // Try fallback to deepseek-chat if we were using deepseek-v3
            if (deepseekModel === "deepseek-v3") {
              console.log("Trying fallback to deepseek-chat...");
              deepseekModel = "deepseek-chat";
              
              deepseekResponse = await fetchWithTimeout("https://api.deepseek.com/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                  model: "deepseek-chat",
                  messages: codeOptimizedMessages.slice(-2).map(m => ({ role: m.role, content: m.content })), // Only last 2 messages
                  temperature: 0.1,
                  max_tokens: 4000, // Reduced for fallback
                  stream: false
                })
              }, 90000); // 90 second timeout for fallback

              if (!deepseekResponse.ok) {
                const fallbackError = await deepseekResponse.text();
                throw new Error(`DeepSeek API error (${deepseekResponse.status}): ${fallbackError}`);
              }
            } else {
              throw new Error(`DeepSeek API error (${deepseekResponse.status}): ${errorText}`);
            }
          }

          const deepseekData = await deepseekResponse.json();
          aiResponse = deepseekData.choices?.[0]?.message?.content || "No response generated";
          
        } catch (deepseekError) {
          console.error("DeepSeek Edge Function error:", deepseekError);
          
          // Provide helpful error message
          if (deepseekError.message.includes("timeout") || deepseekError.message.includes("504")) {
            throw new Error("DeepSeek V3 is experiencing heavy load. Try again in a few moments or use a different model for code generation.");
          } else {
            throw new Error(`DeepSeek V3 code generation failed: ${deepseekError.message}`);
          }
        }
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
            messages: codeOptimizedMessages.map(m => ({ role: m.role, content: m.content })),
            temperature: codeParams.temperature,
            max_tokens: codeParams.maxTokens,
            stream: false
          })
        }, codeParams.timeout);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Grok API error (${response.status}): ${errorText}`);
        }

        const grokData = await response.json();
        aiResponse = grokData.choices?.[0]?.message?.content || "No response generated";
        break;

      case "openrouter":
        // For OpenRouter, use the model ID directly as it already includes the provider prefix
        const openrouterModelId = model;
        
        response = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": request.headers.get("referer") || "",
            "X-Title": "Apeiron Chat"
          },
          body: JSON.stringify({
            model: openrouterModelId,
            messages: codeOptimizedMessages.map(m => ({ role: m.role, content: m.content })),
            temperature: codeParams.temperature,
            max_tokens: codeParams.maxTokens,
            stream: false
          })
        }, codeParams.timeout);

        if (!response.ok) {
          const errorText = await response.text();
          if (response.status === 504) {
            throw new Error(`OpenRouter request timed out. Try a shorter request.`);
          } else if (response.status === 401) {
            throw new Error(`OpenRouter API key is invalid or expired. Please check your API key.`);
          } else if (response.status === 404) {
            throw new Error(`The selected OpenRouter model is not available. Please choose a different model.`);
          } else if (response.status === 402) {
            throw new Error(`OpenRouter credits exhausted. Please check your account balance.`);
          }
          throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
        }

        const openrouterData = await response.json();
        aiResponse = openrouterData.choices?.[0]?.message?.content || "No response generated";
        break;

      case "mistral":
        // Enhanced parameters for Mistral code generation
        const mistralCodeParams = {
          maxTokens: 8000, // Increased for code generation
          temperature: 0.1, // Very low for consistent code
          timeout: 120000  // 2 minutes maximum for Edge Function
        };
        
        // Map model names to Mistral API model names
        let mistralModel = "mistral-large-latest";
        if (model?.includes("large")) mistralModel = "mistral-large-latest";
        else if (model?.includes("medium")) mistralModel = "mistral-medium-latest";
        else if (model?.includes("small")) mistralModel = "mistral-small-latest";
        else if (model?.includes("codestral")) mistralModel = "codestral-latest";
        
        try {
          response = await fetchWithTimeout("https://api.mistral.ai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: mistralModel,
              messages: codeOptimizedMessages.map(m => ({ role: m.role, content: m.content })),
              temperature: mistralCodeParams.temperature,
              max_tokens: mistralCodeParams.maxTokens,
              stream: false
            })
          }, mistralCodeParams.timeout);

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Mistral ${mistralModel} failed:`, response.status, errorText);
            throw new Error(`Mistral API error (${response.status}): ${errorText}`);
          }

          const mistralData = await response.json();
          aiResponse = mistralData.choices?.[0]?.message?.content || "No response generated";
          
        } catch (mistralError) {
          console.error("Mistral Edge Function error:", mistralError);
          
          // Provide helpful error message
          if (mistralError.message.includes("timeout") || mistralError.message.includes("504")) {
            throw new Error("Mistral is experiencing heavy load. Try again in a few moments or use a different model for code generation.");
          } else {
            throw new Error(`Mistral code generation failed: ${mistralError.message}`);
          }
        }
        break;

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    // Ensure we have a valid response with proper validation
    if (!aiResponse || typeof aiResponse !== 'string' || aiResponse.trim().length === 0) {
      console.error('Edge function received invalid AI response:', aiResponse);
      aiResponse = "I apologize, but I couldn't generate a proper code response. This might be due to the request being too complex or the AI service being temporarily unavailable. Please try with a simpler request or try again later.";
    }

    // Clean and validate the response
    const cleanedResponse = aiResponse.trim();

    // Return successful response with proper structure
    const responseData = {
      response: cleanedResponse,
      content: cleanedResponse, // Add both for compatibility
      model: model || provider,
      provider: provider,
      codeGeneration: true,
      edgeFunction: true,
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Edge function error:', error);
    
    // Determine appropriate status code
    let statusCode = 500;
    if (error.message.includes('timed out')) {
      statusCode = 504;
    } else if (error.message.includes('API key')) {
      statusCode = 401;
    } else if (error.message.includes('Invalid') || error.message.includes('required')) {
      statusCode = 400;
    }

    return new Response(JSON.stringify({
      error: 'Code generation failed',
      message: error.message,
      details: error.stack,
      timestamp: new Date().toISOString()
    }), {
      status: statusCode,
      headers: corsHeaders
    });
  }
}; 