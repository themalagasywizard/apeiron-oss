// Netlify Edge Function for AI Code Generation
// Runs at the edge with higher execution time limits
export default async (request, context) => {
  console.log("Edge Function: Code generation request received");
  
  try {
    // Parse the request body
    const requestBody = await request.json();
    const { messages, provider, apiKey, model, temperature, customModelName } = requestBody;

    // Validate required inputs
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({
        error: "Messages array is required and must not be empty"
      }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!provider || typeof provider !== 'string') {
      return new Response(JSON.stringify({
        error: "Valid provider is required"
      }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!apiKey || typeof apiKey !== 'string') {
      return new Response(JSON.stringify({
        error: "Valid API key is required"
      }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    console.log("Edge Function: Processing code generation for provider:", provider);

    // Enhanced code generation parameters (higher limits for Edge Functions)
    const codeParams = {
      maxTokens: 8000, // Higher token limit for code
      temperature: 0.1, // Lower temperature for focused code output
      timeout: 60000   // 60 second timeout for Edge Functions
    };

    // Add code-focused instructions to the last message
    const optimizedMessages = [...messages];
    const lastMessage = optimizedMessages[optimizedMessages.length - 1];
    
    if (lastMessage && lastMessage.role === "user" && lastMessage.content) {
      const codeInstructions = `

ADVANCED CODE GENERATION INSTRUCTIONS:
- Provide complete, production-ready code that can be run immediately
- Include all necessary imports, dependencies, and setup
- Use modern best practices and latest syntax
- Add comprehensive comments explaining complex logic
- For web projects: provide complete HTML, CSS, and JavaScript
- For components: include proper TypeScript types and exports
- For apps: include proper file structure and configuration
- Ensure code is scalable, maintainable, and follows industry standards
- Include error handling where appropriate
- Optimize for performance and accessibility

User Request: ${lastMessage.content}`;

      optimizedMessages[optimizedMessages.length - 1] = {
        ...lastMessage,
        content: codeInstructions
      };
    }

    // Call the appropriate AI provider with enhanced parameters
    let aiResponse = "";
    
    switch (provider) {
      case "openai":
        aiResponse = await callOpenAI(optimizedMessages, apiKey, model, codeParams);
        break;
      case "claude":
        aiResponse = await callClaude(optimizedMessages, apiKey, codeParams);
        break;
      case "gemini":
        aiResponse = await callGemini(optimizedMessages, apiKey, codeParams);
        break;
      case "deepseek":
        aiResponse = await callDeepSeek(optimizedMessages, apiKey, codeParams);
        break;
      case "grok":
        aiResponse = await callGrok(optimizedMessages, apiKey, codeParams);
        break;
      case "openrouter":
        aiResponse = await callOpenRouter(optimizedMessages, apiKey, customModelName, codeParams);
        break;
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    console.log("Edge Function: Code generation completed successfully");

    return new Response(JSON.stringify({
      response: aiResponse,
      model: model,
      provider: provider,
      codeGeneration: true,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Cache-Control": "no-cache"
      }
    });

  } catch (error) {
    console.error("Edge Function error:", error);
    
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Code generation failed",
      timestamp: new Date().toISOString(),
      isEdgeFunction: true
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

// AI Provider Functions with enhanced timeouts for Edge Functions

async function callOpenAI(messages, apiKey, model, params) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), params.timeout);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model?.includes("gpt-3.5") ? "gpt-3.5-turbo" : "gpt-4o",
        messages: messages,
        temperature: params.temperature,
        max_tokens: params.maxTokens,
        stream: false
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "No response generated";
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error("OpenAI request timed out - try a simpler request");
    }
    throw error;
  }
}

async function callClaude(messages, apiKey, params) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), params.timeout);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-opus-20240229",
        max_tokens: params.maxTokens,
        temperature: params.temperature,
        messages: messages
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content[0]?.text || "No response generated";
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error("Claude request timed out - try a simpler request");
    }
    throw error;
  }
}

async function callGemini(messages, apiKey, params) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), params.timeout);

  try {
    const geminiMessages = messages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: geminiMessages,
        generationConfig: {
          temperature: params.temperature,
          maxOutputTokens: params.maxTokens,
          topP: 0.95,
          topK: 40
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates[0]?.content?.parts[0]?.text || "No response generated";
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error("Gemini request timed out - try a simpler request");
    }
    throw error;
  }
}

async function callDeepSeek(messages, apiKey, params) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), params.timeout);

  try {
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: messages,
        temperature: params.temperature,
        max_tokens: params.maxTokens,
        stream: false
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "No response generated";
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error("DeepSeek request timed out - try a simpler request");
    }
    throw error;
  }
}

async function callGrok(messages, apiKey, params) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), params.timeout);

  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "grok-beta",
        messages: messages,
        temperature: params.temperature,
        max_tokens: params.maxTokens,
        stream: false
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Grok API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "No response generated";
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error("Grok request timed out - try a simpler request");
    }
    throw error;
  }
}

async function callOpenRouter(messages, apiKey, customModelName, params) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), params.timeout);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://t3-chat.netlify.app",
        "X-Title": "T3 Chat"
      },
      body: JSON.stringify({
        model: customModelName || "meta-llama/llama-3.1-8b-instruct:free",
        messages: messages,
        temperature: params.temperature,
        max_tokens: params.maxTokens,
        stream: false
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "No response generated";
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error("OpenRouter request timed out - try a simpler request");
    }
    throw error;
  }
} 