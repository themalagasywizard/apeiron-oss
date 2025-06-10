// Netlify Edge Function for AI Code Generation
// Runs at the network edge with higher execution time limits
// Better suited for long-running AI code generation tasks

export default async (request, context) => {
  // Only allow POST requests
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const requestBody = await request.json();
    const { messages, provider, apiKey, model, temperature, customModelName } = requestBody;

    // Validate required inputs
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Messages array is required and must not be empty' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!provider || typeof provider !== 'string') {
      return new Response(JSON.stringify({ error: 'Valid provider is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!apiKey || typeof apiKey !== 'string') {
      return new Response(JSON.stringify({ error: 'Valid API key is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log("Edge Function: Code generation request for provider:", provider);

    // Enhanced code generation instructions
    const optimizeMessagesForCode = (messages) => {
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
    };

    // Optimize messages for code generation
    const codeOptimizedMessages = optimizeMessagesForCode(messages);

    // Extended timeout for Edge Functions (no strict 30s limit)
    const fetchWithTimeout = async (url, options, timeoutMs = 120000) => {
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
          throw new Error(`Code generation timed out after ${timeoutMs / 1000} seconds. Please try with a shorter request.`);
        }
        throw error;
      }
    };

    let response;
    let aiResponse = "";

    // Enhanced parameters for code generation
    const codeParams = {
      maxTokens: 8000, // Higher token limit for complete code
      temperature: 0.1, // Lower temperature for consistent code
      timeout: 120000  // 2 minute timeout for Edge Functions
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
        aiResponse = openaiData.choices[0]?.message?.content || "No response generated";
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
            model: "claude-3-opus-20240229",
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
        aiResponse = claudeData.content[0]?.text || "No response generated";
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
        aiResponse = geminiData.candidates[0]?.content?.parts[0]?.text || "No response generated";
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
        aiResponse = deepseekData.choices[0]?.message?.content || "No response generated";
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
        aiResponse = grokData.choices[0]?.message?.content || "No response generated";
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
        aiResponse = openrouterData.choices[0]?.message?.content || "No response generated";
        break;

      default:
        throw new Error(`Unsupported provider for code generation: ${provider}`);
    }

    // Return successful response
    return new Response(JSON.stringify({
      response: aiResponse,
      model: model,
      provider: provider,
      codeGeneration: true,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error("Edge Function code generation error:", error);
    
    return new Response(JSON.stringify({
      error: error.message || "Code generation failed",
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}; 