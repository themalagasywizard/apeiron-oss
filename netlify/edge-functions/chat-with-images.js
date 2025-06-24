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
          console.log("Original messages structure:", JSON.stringify(messages.map(m => ({
            role: m.role,
            content_type: typeof m.content,
            has_array_content: Array.isArray(m.content),
            content_preview: typeof m.content === 'string' ? m.content.substring(0, 30) : 'non-string content'
          }))));
          
          // Format Gemini request body
          const geminiContents = [];
          
          // Process messages for Gemini format
          for (const msg of messages) {
            console.log(`Processing message with role: ${msg.role}, content type: ${typeof msg.content}, is array: ${Array.isArray(msg.content)}`);
            
            if (msg.role === 'user') {
              if (Array.isArray(msg.content)) {
                // Handle multimodal content (text + images)
                const parts = [];
                
                for (const contentPart of msg.content) {
                  console.log(`Processing content part: ${JSON.stringify({
                    type: contentPart.type,
                    has_text: !!contentPart.text,
                    has_image_url: !!contentPart.image_url
                  })}`);
                  
                  if (contentPart.type === 'text') {
                    parts.push({ text: contentPart.text });
                    console.log(`Added text part: ${contentPart.text.substring(0, 30)}`);
                  } else if (contentPart.type === 'image_url') {
                    // Extract base64 data from image URL
                    const imgUrl = contentPart.image_url?.url || contentPart.image_url;
                    console.log(`Processing image URL: ${typeof imgUrl}, starts with data: ${typeof imgUrl === 'string' && imgUrl.startsWith('data:')}`);
                    
                    if (typeof imgUrl === 'string' && imgUrl.startsWith('data:')) {
                      const parts = imgUrl.split(',');
                      if (parts.length !== 2) {
                        console.error(`Invalid data URL format: ${imgUrl.substring(0, 50)}...`);
                        continue;
                      }
                      
                      const base64Data = parts[1];
                      if (!base64Data) {
                        console.error('No base64 data found in URL');
                        continue;
                      }
                      
                      const mimeTypeMatch = parts[0].match(/data:([^;]+);/);
                      const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg';
                      
                      console.log(`Extracted image data: mimeType=${mimeType}, base64Length=${base64Data.length}`);
                      
                      parts.push({
                        inline_data: {
                          mime_type: mimeType,
                          data: base64Data
                        }
                      });
                      console.log('Added image part with inline_data');
                    } else {
                      console.error('Image URL is not in data: format', imgUrl?.substring(0, 30));
                    }
                  }
                }
                
                if (parts.length === 0) {
                  console.error('No valid parts created from array content');
                  // Add a default text part to avoid empty parts
                  parts.push({ text: "Image processing failed. Please try again." });
                }
                
                geminiContents.push({
                  role: 'user',
                  parts: parts
                });
                console.log(`Added user message with ${parts.length} parts`);
              } else if (typeof msg.content === 'string') {
                // Simple text message
                geminiContents.push({
                  role: 'user',
                  parts: [{ text: msg.content }]
                });
                console.log(`Added simple text user message: ${msg.content.substring(0, 30)}`);
              } else {
                console.error(`Unsupported content type for user message: ${typeof msg.content}`);
                // Add a default message to avoid errors
                geminiContents.push({
                  role: 'user',
                  parts: [{ text: "Content format not supported" }]
                });
              }
            } else if (msg.role === 'assistant') {
              geminiContents.push({
                role: 'model',
                parts: [{ text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }]
              });
              console.log(`Added assistant message`);
            } else if (msg.role === 'system') {
              geminiContents.push({
                role: 'user',
                parts: [{ text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }]
              });
              console.log(`Added system message as user`);
            }
          }

          // Validate that we have at least one message with valid parts
          if (geminiContents.length === 0) {
            throw new Error('No valid messages to send to Gemini API');
          }
          
          // Check if any message has empty parts
          const emptyPartMessages = geminiContents.filter(msg => !msg.parts || msg.parts.length === 0);
          if (emptyPartMessages.length > 0) {
            console.error(`Found ${emptyPartMessages.length} messages with empty parts`);
            // Fix messages with empty parts
            for (const msg of geminiContents) {
              if (!msg.parts || msg.parts.length === 0) {
                msg.parts = [{ text: "Content unavailable" }];
              }
            }
          }

          const geminiBody = {
            contents: geminiContents,
            generationConfig: {
              temperature: chatParams.temperature,
              maxOutputTokens: hasImageAttachments ? 4096 : 2048,
            }
          };

          console.log("Formatted Gemini request with contents:", JSON.stringify(geminiContents.map(c => ({
            role: c.role,
            parts_count: c.parts.length,
            has_text: c.parts.some(p => p.text),
            has_image: c.parts.some(p => p.inline_data),
            parts_preview: c.parts.map(p => p.text ? { text_preview: p.text.substring(0, 20) } : (p.inline_data ? { mime: p.inline_data.mime_type, data_length: p.inline_data.data?.length || 0 } : 'unknown'))
          }))));

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