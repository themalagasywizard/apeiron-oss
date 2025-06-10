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

ADVANCED CODE GENERATION INSTRUCTIONS:
- Focus PRIMARILY on providing complete, working, production-ready code
- Minimize explanatory text - let the code be self-documenting
- Use comprehensive comments within the code for necessary explanations
- Provide complete, functional examples that can be run immediately
- For HTML/CSS/JS: provide a complete working example with all necessary dependencies
- For components: include all necessary imports, exports, and prop types
- For applications: include file structure, configuration, and setup instructions
- Keep descriptions brief and to the point - focus on implementation details
- Prioritize code quality, completeness, and best practices over lengthy explanations
- Include error handling and edge cases in the code
- Use modern syntax and current best practices

SPECIFIC HTML/CSS INSTRUCTIONS:
- ALWAYS embed CSS within <style> tags inside the HTML <head> section
- NEVER provide separate CSS files or blocks - integrate ALL styles into the HTML
- Create complete, self-contained HTML files that work immediately when opened
- Include responsive design and modern CSS practices
- Add proper meta tags, viewport settings, and semantic HTML structure
- Ensure all images, fonts, and resources are either embedded or use CDN links
- Test that the HTML file would work completely standalone
- Include interactive JavaScript within <script> tags if needed
- Use modern CSS features like Flexbox, Grid, and CSS Variables
- Optimize for both desktop and mobile viewing

CRITICAL: For any web-related request, provide a SINGLE, complete HTML file with embedded styles and scripts.

User Request: ${lastMessage.content}`;

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
        response = await fetchWithTimeout("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: codeOptimizedMessages.map(m => ({ role: m.role, content: m.content })),
            temperature: codeParams.temperature,
            max_tokens: codeParams.maxTokens,
            stream: false
          })
        }, codeParams.timeout);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`DeepSeek API error (${response.status}): ${errorText}`);
        }

        const deepseekData = await response.json();
        aiResponse = deepseekData.choices?.[0]?.message?.content || "No response generated";
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