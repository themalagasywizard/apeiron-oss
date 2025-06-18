// Netlify Edge Function for AI Code Generation
// Runs on Deno runtime at the network edge with higher execution limits

export default async (request, context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, openai-api-key, claude-api-key, gemini-api-key, openrouter-api-key',
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
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

  const transformStream = new TransformStream();
  const writer = transformStream.writable.getWriter();
  const encoder = new TextEncoder();

  try {
    const { messages, provider, apiKey, model, temperature = 0.1, customModelName } = requestBody;

    // Validate required inputs with detailed error messages
    if (!messages) {
      throw new Error('Messages array is required');
    }

    if (!Array.isArray(messages)) {
      throw new Error(`Messages must be an array, received ${typeof messages}`);
    }

    if (messages.length === 0) {
      throw new Error('Messages array must not be empty');
    }

    if (!provider || typeof provider !== 'string') {
      throw new Error(`Valid provider is required, received ${provider}`);
    }

    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error('Valid API key is required');
    }

    // Log request info for debugging
    console.log(`Edge Function: Code generation request for provider: ${provider}`);

    // Optimized parameters for edge function environment
    const codeParams = {
      maxTokens: 4000,
      temperature: temperature || 0.1,
      timeout: 25000
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

    // Provider-specific handling
    switch (provider.toLowerCase()) {
      case "openrouter": {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": request.headers.get("referer") || "https://apeiron.app",
            "X-Title": "Apeiron"
          },
          body: JSON.stringify({
            model: model,
            messages: codeOptimizedMessages,
            temperature: codeParams.temperature,
            max_tokens: codeParams.maxTokens,
            stream: true
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
        }

        // Stream the response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            await writer.write(encoder.encode(chunk));
          }
        } finally {
          await writer.close();
        }

        return new Response(transformStream.readable, {
          headers: corsHeaders
        });
      }

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  } catch (error) {
    console.error('Edge function error:', error);
    
    // Ensure we close the writer if there was an error
    await writer.close();
    
    return new Response(JSON.stringify({ 
      error: error.message || 'An unexpected error occurred'
    }), {
      status: error.status || 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
}; 