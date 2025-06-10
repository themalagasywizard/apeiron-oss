// Netlify Edge Function for AI Code Generation
// Runs on Deno runtime at the network edge with higher execution time limits

export default async (request, context) => {
  // Add CORS headers for all responses
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
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
    
    requestBody = JSON.parse(bodyText);
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Invalid JSON in request body',
      details: error.message 
    }), {
      status: 400,
      headers: corsHeaders
    });
  }

  try {
    const { messages, provider, apiKey, model, temperature, customModelName } = requestBody;

    // Validate required inputs
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Messages array is required and must not be empty' }), {
        status: 400,
        headers: corsHeaders
      });
    }

    if (!provider || typeof provider !== 'string') {
      return new Response(JSON.stringify({ error: 'Valid provider is required' }), {
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

    // Log for debugging (Deno compatible)
    console.log(`Edge Function: Code generation request for provider: ${provider}`);

    // Enhanced code generation instructions
    const optimizeMessagesForCode = (messages) => {
      try {
        const optimizedMessages = [...messages];
        const lastMessage = optimizedMessages[optimizedMessages.length - 1];
        
        if (lastMessage && lastMessage.role === "user" && lastMessage.content) {
          const codeInstructions = `

CRITICAL CODE GENERATION MODE - FOLLOW EXACTLY:

YOU ARE IN CODE GENERATION MODE. YOUR PRIMARY TASK IS TO GENERATE CLEAN, WORKING CODE WITH MINIMAL EXPLANATORY TEXT.

MANDATORY RULES:
1. Start your response with working code inside code blocks
2. NO lengthy explanations before the code
3. NO tutorials or step-by-step instructions
4. NO marketing language or descriptions
5. MINIMAL text outside of code blocks

FOR HTML/CSS REQUESTS:
- IMMEDIATELY provide a complete HTML file with embedded CSS
- Put ALL CSS inside <style> tags in the <head> section
- NO separate CSS blocks or files
- NO explanations about "how to use this code"
- NO descriptions of features
- COMPLETE, working, standalone HTML file that opens in any browser
- Include proper DOCTYPE, html, head, and body structure
- Add responsive meta tags and modern CSS practices
- Use semantic HTML and proper accessibility features

RESPONSE FORMAT FOR HTML:
\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Title</title>
    <style>
        /* ALL YOUR CSS GOES HERE */
    </style>
</head>
<body>
    <!-- ALL YOUR HTML CONTENT GOES HERE -->
</body>
</html>
\`\`\`

CRITICAL: Do NOT provide any explanatory text before or after the code. Just provide the complete working HTML file.

USER REQUEST: ${lastMessage.content}

RESPOND WITH WORKING CODE ONLY:`;

          optimizedMessages[optimizedMessages.length - 1] = {
            ...lastMessage,
            content: codeInstructions
          };
        }
        
        return optimizedMessages;
      } catch (error) {
        console.error('Error optimizing messages:', error);
        return messages; // Return original messages on error
      }
    };

    // Optimize messages for code generation
    const codeOptimizedMessages = optimizeMessagesForCode(messages);

    // Fetch with timeout for Deno
    const fetchWithTimeout = async (url, options, timeoutMs = 60000) => {
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
        if (error.name === 'AbortError') {
          throw new Error(`Code generation timed out after ${timeoutMs / 1000} seconds`);
        }
        throw error;
      }
    };

    let response;
    let aiResponse = "";

    // Enhanced parameters for code generation
    const codeParams = {
      maxTokens: 6000, // Conservative for Edge Function
      temperature: 0.1, // Lower temperature for consistent code
      timeout: 60000   // 60 second timeout for Edge Functions
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
            model: model?.includes("gpt-3.5") ? "gpt-3.5-turbo" : "gpt-4o",
            messages: codeOptimizedMessages.map(m => ({ role: m.role, content: m.content })),
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
            model: "claude-3-5-sonnet-20241022",
            max_tokens: codeParams.maxTokens,
            temperature: codeParams.temperature,
            messages: codeOptimizedMessages.map(m => ({ role: m.role, content: m.content }))
          })
        }, codeParams.timeout);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Claude API error (${response.status}): ${errorText}`);
        }

        const claudeData = await response.json();
        aiResponse = claudeData.content?.[0]?.text || "No response generated";
        break;

      case "gemini":
        response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`, {
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
        // Try deepseek-coder first, fallback to deepseek-chat
        let deepseekModel = "deepseek-coder";
        let deepseekResponse;
        
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
              temperature: Math.min(codeParams.temperature, 0.2), // Even lower temperature for code
              max_tokens: Math.min(codeParams.maxTokens, 4000), // Reduced tokens
              stream: false
            })
          }, codeParams.timeout);

          if (!deepseekResponse.ok) {
            const errorText = await deepseekResponse.text();
            console.error("DeepSeek-coder failed:", deepseekResponse.status, errorText);
            
            // Try fallback to deepseek-chat
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
                max_tokens: 2000, // Further reduced
                stream: false
              })
            }, 45000); // Shorter timeout for fallback

            if (!deepseekResponse.ok) {
              const fallbackError = await deepseekResponse.text();
              throw new Error(`DeepSeek API error (${deepseekResponse.status}): ${fallbackError}`);
            }
          }

          const deepseekData = await deepseekResponse.json();
          aiResponse = deepseekData.choices?.[0]?.message?.content || "No response generated";
          
        } catch (deepseekError) {
          console.error("DeepSeek Edge Function error:", deepseekError);
          
          // Provide helpful error message
          if (deepseekError.message.includes("timeout") || deepseekError.message.includes("504")) {
            throw new Error("DeepSeek is experiencing heavy load. Try again in a few moments or use a different model for code generation.");
          } else {
            throw new Error(`DeepSeek code generation failed: ${deepseekError.message}`);
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
            messages: codeOptimizedMessages.map(m => ({ role: m.role, content: m.content })),
            temperature: codeParams.temperature,
            max_tokens: codeParams.maxTokens,
            stream: false
          })
        }, codeParams.timeout);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
        }

        const openrouterData = await response.json();
        aiResponse = openrouterData.choices?.[0]?.message?.content || "No response generated";
        break;

      default:
        throw new Error(`Unsupported provider for code generation: ${provider}`);
    }

    // Ensure we have a valid response
    if (!aiResponse || typeof aiResponse !== 'string') {
      throw new Error('No valid response from AI provider');
    }

    // Return successful response with proper structure
    const responseData = {
      response: aiResponse,
      model: model || provider,
      provider: provider,
      codeGeneration: true,
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error("Edge Function error:", error);
    
    // Return error response with proper structure
    const errorResponse = {
      error: error.message || "Code generation failed",
      timestamp: new Date().toISOString(),
      edgeFunction: true
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: corsHeaders
    });
  }
}; 