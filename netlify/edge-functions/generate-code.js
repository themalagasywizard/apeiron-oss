// Netlify Edge Function for AI Code Generation
// Runs on Deno runtime at the network edge with higher execution time limits

export default async (request, context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, openai-api-key, claude-api-key, gemini-api-key, openrouter-api-key',
  };

  // Handle OPTIONS request for CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders,
      status: 204,
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }

  let requestBody;
  try {
    requestBody = await request.json();
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
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
      maxTokens: 4000, // Increased for code generation
      temperature: temperature || 0.1,
      timeout: 25000  // 25 second timeout (Netlify limit is 30s)
    };

    // Optimize messages for code generation
    const optimizeMessagesForCode = (messages) => {
      try {
        const optimizedMessages = [...messages];
        const lastMessage = optimizedMessages[optimizedMessages.length - 1];
        
        if (lastMessage && lastMessage.role === "user" && lastMessage.content) {
          const codeInstructions = `Generate production-ready code for: "${lastMessage.content}"
Key requirements:
- Working code with all necessary imports
- Modern best practices and patterns
- Clear comments explaining the code
- Security best practices
- Error handling
- Type safety where applicable`;

          optimizedMessages[optimizedMessages.length - 1] = {
            ...lastMessage,
            content: codeInstructions
          };
        }
        
        // Add system message for code generation
        optimizedMessages.unshift({
          role: "system",
          content: "You are an expert programmer. Focus on generating clean, efficient, and well-documented code. Include all necessary imports and dependencies. Follow modern best practices and security guidelines."
        });
        
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
      case "openrouter":
        // For OpenRouter, use the model ID directly as it already includes the provider prefix
        const openrouterModelId = model;
        
        response = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": request.headers.get("referer") || "https://apeiron.app",
            "X-Title": "Apeiron"
          },
          body: JSON.stringify({
            model: openrouterModelId,
            messages: codeOptimizedMessages.map(m => ({ role: m.role, content: m.content })),
            temperature: codeParams.temperature,
            max_tokens: codeParams.maxTokens,
            stream: true // Enable streaming for faster initial response
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

        // Handle streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.trim() === '') continue;
              if (line.trim() === 'data: [DONE]') continue;

              try {
                const data = JSON.parse(line.replace(/^data: /, ''));
                if (data.choices?.[0]?.delta?.content) {
                  aiResponse += data.choices[0].delta.content;
                }
              } catch (e) {
                console.warn('Error parsing SSE line:', e);
              }
            }
          }
        } catch (error) {
          console.error('Error reading stream:', error);
          throw new Error('Error reading response stream');
        } finally {
          reader.releaseLock();
        }
        break;

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    // Return the generated code
    return new Response(JSON.stringify({ 
      success: true,
      response: aiResponse,
      model: model
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('Code generation error:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Code generation failed',
      details: error.toString()
    }), {
      status: error.status || 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
}; 