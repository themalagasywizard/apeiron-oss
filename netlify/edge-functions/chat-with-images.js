// Netlify Edge Function for AI Chat with Images
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
    const { 
      messages, 
      provider, 
      apiKey, 
      model, 
      temperature = 0.7,
      hasImageAttachments = false
    } = requestBody;

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
    console.log(`Edge Function: Chat with images request for provider: ${provider}`);
    console.log('Request details:', {
      provider,
      model,
      messagesCount: messages.length,
      hasApiKey: !!apiKey,
      hasImageAttachments
    });

    // Optimized parameters for edge function environment with longer timeouts for image processing
    const chatParams = {
      temperature: temperature || 0.7,
      timeout: hasImageAttachments ? 50000 : 25000  // 50 seconds for image requests, 25 for regular (Netlify limit is 60s)
    };

    // Fetch with timeout and automatic retry
    const fetchWithTimeout = async (url, options, timeoutMs = chatParams.timeout) => {
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
              model: model || "gpt-4-vision-preview",
              messages: messages,
              temperature: chatParams.temperature,
              max_tokens: hasImageAttachments ? 4096 : 2048,
              stream: false
            })
          }, chatParams.timeout);

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
              max_tokens: hasImageAttachments ? 4096 : 2048,
              temperature: chatParams.temperature,
              messages: messages
            })
          }, chatParams.timeout);

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Claude API error (${response.status}): ${errorText}`);
          }

          const claudeData = await response.json();
          aiResponse = claudeData.content?.[0]?.text || "No response generated";
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
        } else if (model && model.includes("2.0-flash")) {
          geminiModel = "gemini-2.0-flash-001";
        } else if (model && model.includes("1.5-flash")) {
          geminiModel = "gemini-1.5-flash-001";
        } else if (model && model.includes("1.0-pro")) {
          geminiModel = "gemini-1.0-pro";
        } else if (model && model.includes("1.0")) {
          geminiModel = "gemini-1.0-pro";
        }

        try {
          // Format Gemini request body
          const geminiBody = {
            contents: messages.map(msg => {
              if (msg.role === 'user') {
                return { role: 'user', parts: Array.isArray(msg.content) ? msg.content : [{ text: msg.content }] };
              } else if (msg.role === 'assistant') {
                return { role: 'model', parts: [{ text: msg.content }] };
              } else if (msg.role === 'system') {
                return { role: 'user', parts: [{ text: msg.content }] };
              }
              return null;
            }).filter(Boolean),
            generationConfig: {
              temperature: chatParams.temperature,
              maxOutputTokens: hasImageAttachments ? 4096 : 2048,
            }
          };

          response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey
            },
            body: JSON.stringify(geminiBody)
          }, chatParams.timeout);

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API error (${response.status}): ${errorText}`);
          }

          const geminiData = await response.json();
          aiResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated";
        } catch (error) {
          console.error('Gemini API error:', error);
          throw new Error(`Gemini API error: ${error.message}`);
        }
        break;

      case "openrouter":
        try {
          // Extract the model ID from the OpenRouter model string
          const openrouterModelId = model || "anthropic/claude-3-sonnet";
          
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
              messages: messages,
              temperature: chatParams.temperature,
              max_tokens: hasImageAttachments ? 4096 : 2048,
              stream: false
            })
          }, chatParams.timeout);

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
          }

          const openrouterData = await response.json();
          aiResponse = openrouterData.choices?.[0]?.message?.content || "No response generated";
        } catch (error) {
          console.error('OpenRouter API error:', error);
          throw new Error(`OpenRouter API error: ${error.message}`);
        }
        break;

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    // Return successful response
    return new Response(JSON.stringify({
      content: aiResponse,
      response: aiResponse,
      model: model,
      provider: provider,
      edgeFunction: true,
      imageProcessing: hasImageAttachments
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(JSON.stringify({
      error: `Edge function error: ${error.message}`,
      model: requestBody?.model,
      provider: requestBody?.provider
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}; 