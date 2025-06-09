import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { messages, provider, apiKey, model, temperature, customModelName } = await request.json();

    let response;
    let aiResponse = "";

    switch (provider) {
      case "openai":
        response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model.includes("gpt-3.5") ? "gpt-3.5-turbo" : "gpt-4",
            messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
            temperature: temperature || 0.7,
            stream: false
          })
        });

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
        }

        const openaiData = await response.json();
        aiResponse = openaiData.choices[0]?.message?.content || "No response";
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
          throw new Error(`Claude API error: ${response.status} - ${errorData}`);
        }

        const claudeData = await response.json();
        aiResponse = claudeData.content[0]?.text || "No response";
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
          throw new Error(`Gemini API error: ${response.status} - ${errorData}`);
        }

        const geminiData = await response.json();
        aiResponse = geminiData.candidates[0]?.content?.parts[0]?.text || "No response";
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
          throw new Error(`DeepSeek API error: ${response.status} - ${errorData}`);
        }

        const deepseekData = await response.json();
        aiResponse = deepseekData.choices[0]?.message?.content || "No response";
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
          throw new Error(`Grok API error: ${response.status} - ${errorData}`);
        }

        const grokData = await response.json();
        aiResponse = grokData.choices[0]?.message?.content || "No response";
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
          throw new Error(`OpenRouter API error: ${response.status} - ${errorData}`);
        }

        const openrouterData = await response.json();
        aiResponse = openrouterData.choices[0]?.message?.content || "No response";
        break;

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    return NextResponse.json({ response: aiResponse });

  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error occurred" },
      { status: 500 }
    );
  }
} 