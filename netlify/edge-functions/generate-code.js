// Netlify Edge Function for AI Code Generation
// Runs on Deno runtime at the network edge with higher execution time limits

// Enhanced logging function that ensures visibility in Netlify logs
const log = (message, data = {}) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    source: 'edge-function',
    message,
    ...data
  };
  
  // Use console.log for Netlify Edge logging
  console.log(JSON.stringify(logEntry));
};

export default async (request, context) => {
  const requestStartTime = Date.now();
  log('Edge function started', { path: request.url });

  // Add CORS headers for all responses
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    log('Handling OPTIONS request');
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Only allow POST requests
  if (request.method !== 'POST') {
    log('Invalid method', { method: request.method });
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders
    });
  }

  let requestBody;
  
  try {
    // Parse request body with error handling
    const bodyText = await request.text();
    log('Request body received', { 
      size: bodyText.length,
      preview: bodyText.substring(0, 100) + '...'
    });

    if (!bodyText) {
      log('Empty request body');
      return new Response(JSON.stringify({ error: 'Empty request body' }), {
        status: 400,
        headers: corsHeaders
      });
    }
    
    try {
      requestBody = JSON.parse(bodyText);
      log('Request body parsed', { 
        provider: requestBody.provider,
        model: requestBody.model,
        messageCount: requestBody.messages?.length
      });
    } catch (parseError) {
      log('JSON parse error', { 
        error: parseError.message,
        bodyPreview: bodyText.substring(0, 100)
      });
      return new Response(JSON.stringify({ 
        error: 'Invalid JSON in request body',
        details: parseError.message
      }), {
        status: 400,
        headers: corsHeaders
      });
    }
  } catch (error) {
    log('Request body read error', { error: error.message });
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
      log('Validation error: missing messages');
      return new Response(JSON.stringify({ error: 'Messages array is required' }), {
        status: 400,
        headers: corsHeaders
      });
    }

    if (!Array.isArray(messages)) {
      log('Validation error: messages not an array', { type: typeof messages });
      return new Response(JSON.stringify({ 
        error: 'Messages must be an array',
        received: typeof messages
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    if (messages.length === 0) {
      log('Validation error: empty messages array');
      return new Response(JSON.stringify({ error: 'Messages array must not be empty' }), {
        status: 400,
        headers: corsHeaders
      });
    }

    if (!provider || typeof provider !== 'string') {
      log('Validation error: invalid provider', { provider });
      return new Response(JSON.stringify({ 
        error: 'Valid provider is required',
        received: provider
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    if (!apiKey || typeof apiKey !== 'string') {
      log('Validation error: missing or invalid API key');
      return new Response(JSON.stringify({ error: 'Valid API key is required' }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Log request info
    log('Processing code generation request', {
      provider,
      model,
      messagesCount: messages.length,
      hasApiKey: !!apiKey
    });

    // Optimized parameters for edge function environment
    const codeParams = {
      maxTokens: 2000,
      temperature: temperature || 0.1,
      timeout: 25000
    };

    // Special parameters for OpenRouter code generation
    const openRouterCodeParams = {
      maxTokens: 4000,
      temperature: 0.1,
      timeout: 55000, // Reduced to stay within Netlify's 60s limit
      prompt_prefix: "[INST] You are a code-only assistant. NEVER include explanations or text. ONLY output code blocks. [/INST]",
      response_format: {
        type: "text",
        structure: "code_only"
      }
    };

    // Optimize messages for code generation
    const optimizeMessagesForCode = (messages) => {
      try {
        const optimizedMessages = [...messages];
        const lastMessage = optimizedMessages[optimizedMessages.length - 1];
        
        if (lastMessage && lastMessage.role === "user" && lastMessage.content) {
          let codeInstructions = `${lastMessage.content}\n\nRequirements:\n- Complete, runnable code only\n- Include imports\n- Minimal text explanation\n- Focus on implementation`;

          // OpenRouter-specific optimization
          if (provider === 'openrouter') {
            codeInstructions = `[INST] Generate code only. No explanations.\n${lastMessage.content}\n[/INST]`;
          }

          optimizedMessages[optimizedMessages.length - 1] = {
            ...lastMessage,
            content: codeInstructions
          };
        }
        
        return optimizedMessages;
      } catch (error) {
        log('Message optimization error', { error: error.message });
        return messages;
      }
    };

    const codeOptimizedMessages = optimizeMessagesForCode(messages);

    // Enhanced fetch with better timeout handling
    const fetchWithTimeout = async (url, options, timeoutMs = 25000) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const startTime = Date.now();
        log(`Starting request to ${url}`);
        
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });
        
        const endTime = Date.now();
        log(`Request completed in ${endTime - startTime}ms`);
        
        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        log('Fetch error', { error: error.message });
        
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
          log('OpenAI API error', { error: error.message });
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
          log('Claude API error', { error: error.message });
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
            log(`DeepSeek ${deepseekModel} failed`, { status: deepseekResponse.status, error: errorText });
            
            // Try fallback to deepseek-chat if we were using deepseek-v3
            if (deepseekModel === "deepseek-v3") {
              log("Trying fallback to deepseek-chat...");
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
          log('DeepSeek Edge Function error', { error: deepseekError.message });
          
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
        try {
          log('Processing OpenRouter code generation request', { model });
          
          response = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`,
              "HTTP-Referer": request.headers.get("referer") || "https://localhost:3000",
              "X-Title": "T3-OSS Code Generation"
            },
            body: JSON.stringify({
              model: model,
              messages: codeOptimizedMessages,
              temperature: openRouterCodeParams.temperature,
              max_tokens: openRouterCodeParams.maxTokens,
              prompt_prefix: openRouterCodeParams.prompt_prefix,
              response_format: openRouterCodeParams.response_format
            })
          }, openRouterCodeParams.timeout);

          if (!response.ok) {
            const errorText = await response.text();
            log('OpenRouter API error', { 
              status: response.status,
              error: errorText
            });
            throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
          }

          const data = await response.json();
          log('OpenRouter response received', {
            status: response.status,
            hasChoices: !!data.choices,
            messageLength: data.choices?.[0]?.message?.content?.length
          });

          aiResponse = data.choices?.[0]?.message?.content || "";
          
          // Extract code blocks only
          const codeBlockRegex = /```[\s\S]*?```/g;
          const codeBlocks = aiResponse.match(codeBlockRegex);
          
          if (codeBlocks && codeBlocks.length > 0) {
            // Remove markdown code block syntax and join blocks
            aiResponse = codeBlocks
              .map(block => block.replace(/```[\w]*\n?|\n?```/g, ''))
              .join('\n\n');
          }
          
          break;
        } catch (error) {
          log('OpenRouter processing error', { error: error.message });
          throw error;
        }

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
            log(`Mistral ${mistralModel} failed`, { status: response.status, error: errorText });
            throw new Error(`Mistral API error (${response.status}): ${errorText}`);
          }

          const mistralData = await response.json();
          aiResponse = mistralData.choices?.[0]?.message?.content || "No response generated";
          
        } catch (mistralError) {
          log('Mistral Edge Function error', { error: mistralError.message });
          
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
      log('Edge function received invalid AI response', { aiResponse });
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

    // Log final response
    const totalDuration = Date.now() - requestStartTime;
    log('Edge function completed', {
      duration: totalDuration,
      status: 'success',
      responseLength: cleanedResponse.length
    });

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    log('Edge function error', { 
      error: error.message,
      duration: Date.now() - requestStartTime
    });
    
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