import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { messages, provider, apiKey, model, temperature, customModelName } = await request.json();

    let response;
    let aiResponse = "";

    // Helper function to safely parse JSON with fallback
    const safeJsonParse = async (response: Response, providerName: string) => {
      const text = await response.text();
      if (!text || text.trim() === '') {
        throw new Error(`${providerName} returned an empty response. Please try again.`);
      }
      
      try {
        return JSON.parse(text);
      } catch (parseError) {
        console.error(`${providerName} JSON parse error:`, parseError);
        console.error(`${providerName} response text:`, text);
        throw new Error(`${providerName} returned an invalid response. Please try again.`);
      }
    };

    switch (provider) {
      case "openai":
        response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model.includes("gpt-3.5") ? "gpt-3.5-turbo" : "gpt-4o",
            messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
            temperature: temperature || 0.7,
            stream: false
          })
        });

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`OpenAI is currently unavailable (${response.status}). Please try again in a moment.`);
        }

        const openaiData = await safeJsonParse(response, "OpenAI");
        aiResponse = openaiData.choices[0]?.message?.content || "OpenAI didn't provide a response. Please try again.";
        break;

      case "claude":
        response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: "claude-3-opus-20240229",
            max_tokens: 4000,
            temperature: temperature || 0.7,
            messages: messages.map((m: any) => ({ role: m.role, content: m.content }))
          })
        });

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`Claude is currently unavailable (${response.status}). Please try again in a moment.`);
        }

        const claudeData = await safeJsonParse(response, "Claude");
        aiResponse = claudeData.content[0]?.text || "Claude didn't provide a response. Please try again.";
        break;

      case "gemini":
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: messages.map((m: any) => ({
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: m.content }]
            })),
            generationConfig: {
              temperature: temperature || 0.7,
              maxOutputTokens: 4000
            }
          })
        });

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`Gemini is currently unavailable (${response.status}). Please try again in a moment.`);
        }

        const geminiData = await safeJsonParse(response, "Gemini");
        aiResponse = geminiData.candidates[0]?.content?.parts[0]?.text || "Gemini didn't provide a response. Please try again.";
        break;

      case "deepseek":
        response = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
            temperature: temperature || 0.7,
            stream: false
          })
        });

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`DeepSeek is currently unavailable (${response.status}). Please try again in a moment.`);
        }

        const deepseekData = await safeJsonParse(response, "DeepSeek");
        aiResponse = deepseekData.choices[0]?.message?.content || "DeepSeek didn't provide a response. Please try again.";
        break;

      case "grok":
        response = await fetch("https://api.x.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: "grok-beta",
            messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
            temperature: temperature || 0.7,
            stream: false
          })
        });

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`Grok is currently unavailable (${response.status}). Please try again in a moment.`);
        }

        const grokData = await safeJsonParse(response, "Grok");
        aiResponse = grokData.choices[0]?.message?.content || "Grok didn't provide a response. Please try again.";
        break;

      case "openrouter":
        response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": request.headers.get("referer") || "",
            "X-Title": "T3 Chat"
          },
          body: JSON.stringify({
            model: customModelName || "meta-llama/llama-3.1-8b-instruct:free",
            messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
            temperature: temperature || 0.7,
            stream: false
          })
        });

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`OpenRouter is currently unavailable (${response.status}). Please try again in a moment.`);
        }

        const openrouterData = await safeJsonParse(response, "OpenRouter");
        aiResponse = openrouterData.choices[0]?.message?.content || "OpenRouter didn't provide a response. Please try again.";
        break;

      case "veo2":
        // VEO2 video generation using dedicated endpoint
        const prompt = messages[messages.length - 1]?.content || "";
        
        response = await fetch(`${request.url.replace('/api/chat', '/api/veo2')}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            prompt: prompt,
            apiKey: apiKey,
            duration: "5s",
            aspectRatio: "16:9"
          })
        });

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`VEO2 is currently unavailable (${response.status}). Please try again in a moment.`);
        }

        const veo2Data = await safeJsonParse(response, "VEO2");
        aiResponse = veo2Data.data?.message || "Video generation initiated with VEO2";
        break;

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    return NextResponse.json({ 
      response: aiResponse,
      model: model,
      provider: provider
    });

  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error occurred" },
      { status: 500 }
    );
  }
} 