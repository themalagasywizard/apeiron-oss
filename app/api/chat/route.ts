"use strict";

import { NextRequest, NextResponse } from "next/server";

// Define attachment type
type Attachment = {
  id?: string;
  type?: string;
  url?: string;
  name?: string;
  size?: number;
  uploadedAt?: string;
};

// Define request body type
type ChatRequestBody = {
  messages: any[];
  model: string;
  provider: string;
  apiKey: string;
  geminiApiKey?: string;
  openaiApiKey?: string;
  runwayApiKey?: string;
  customModelName?: string;
  webSearchEnabled?: boolean | string;
  enhancedWebSearch?: boolean | string;
  codeGenerationEnabled?: boolean | string;
  temperature?: number;
  userLocation?: string;
  retryCount?: number;
};

// Add fetchWithTimeout function at the top of the file
const fetchWithTimeout = async (url: string, options: RequestInit, timeout: number): Promise<Response> => {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    }).catch(error => {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw error;
    });
    
    clearTimeout(id);
    return response;
  } catch (error) {
    console.error(`[ERROR] Fetch error in fetchWithTimeout: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
};

// Helper function to get provider from model ID
function getModelProvider(modelId: string): string {
  // Special handling for OpenRouter format models (e.g. openai/gpt-4, anthropic/claude-3)
  if (modelId.includes('/')) {
    return 'openrouter';
  }

  if (modelId.includes('claude')) return 'claude';
  if (modelId.includes('gpt') || modelId.includes('o3')) return 'openai';
  if (modelId.includes('gemini')) return 'gemini';
  if (modelId.includes('veo2')) return 'veo2';
  if (modelId.includes('deepseek')) return 'deepseek';
  if (modelId.includes('grok')) return 'grok';
  if (modelId.includes('mistral') || modelId.includes('codestral')) return 'mistral';
  if (modelId.includes('gen3') || modelId.includes('gen2') || modelId.includes('runway')) return 'runway';
  return 'openai';
}

// Helper function to convert string or boolean to boolean
function toBooleanStrict(value: string | boolean | undefined): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return false;
}

// Helper function to get optimized parameters based on provider
function getOptimizedParams(maxTokens = 4000, timeout = 25000) {
  return {
    maxTokens,
    temperature: 0.1, // Lower temperature for more focused responses
    timeout
  };
}

// Helper function to optimize messages for code generation
function optimizeMessagesForCode(messages: any[]) {
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
}

// Helper function to safely parse JSON with fallback
const safeJsonParse = async (response: Response, providerName: string) => {
  const text = await response.text();
  if (!text || text.trim() === '') {
    throw new Error(`${providerName} returned an empty response. Please try again.`);
  }
  
  try {
    const parsed = JSON.parse(text);
    return parsed;
  } catch (parseError) {
    console.error(`[ERROR] ${providerName} JSON parse error:`, parseError);
    throw new Error(`${providerName} returned an invalid response format. Please try again.`);
  }
};

// Helper function to validate and clean AI responses
const cleanAIResponse = (response: string, providerName: string): string => {
  if (!response || typeof response !== 'string') {
    console.error(`[ERROR] ${providerName} returned invalid response type:`, typeof response);
    return `I apologize, but ${providerName} returned an invalid response. Please try again.`;
  }
  
  // Ensure the response is properly terminated (not cut off)
  const trimmed = response.trim();
  if (trimmed.length === 0) {
    console.error(`[ERROR] ${providerName} returned empty response`);
    return `I apologize, but ${providerName} returned an empty response. Please try again.`;
  }
  
  return trimmed;
};

// Helper function to perform web search
const performWebSearch = async (query: string, userLocation: string | null): Promise<any[]> => {
  try {
    console.log("[DEBUG] Performing basic web search for:", query);
    // This is a simplified implementation - in a real app, you would call an actual search API
    return []; // Return empty results for now
  } catch (error) {
    console.error("[ERROR] Web search error:", error);
    return [];
  }
};

// Helper function to perform enhanced web search with content extraction
const performEnhancedWebSearch = async (query: string, userLocation: string | null): Promise<any[]> => {
  try {
    console.log("[DEBUG] Performing enhanced web search for:", query);
    // This is a simplified implementation - in a real app, you would call an actual search API
    return []; // Return empty results for now
  } catch (error) {
    console.error("[ERROR] Enhanced web search error:", error);
    return [];
  }
};

// Helper function to format search results for AI consumption
const formatSearchResultsForAI = (results: any[]): string => {
  try {
    return results.map((result: any, index: number) => {
      return `[${index + 1}] Title: ${result.title || 'No title'}
URL: ${result.url || 'No URL'}
Snippet: ${result.snippet || 'No snippet available'}`;
    }).join('\n\n');
      } catch (error) {
    console.error("[ERROR] Error formatting search results:", error);
    return "Error formatting search results.";
  }
};

// API Route optimized for serverless environments (Netlify/Vercel)
// Timeouts are kept under 25 seconds due to serverless function limits
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      console.error("[ERROR] Failed to parse request body:", error);
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const {
      messages,
        model, 
            provider,
            apiKey,
      geminiApiKey,
      openaiApiKey,
      runwayApiKey,
      customModelName,
      webSearchEnabled,
      enhancedWebSearch,
      codeGenerationEnabled,
      temperature = 0.7,
      userLocation,
      retryCount = 0
    } = body;

    // Validate required parameters
    if (!messages || !Array.isArray(messages)) {
      console.error("[ERROR] Missing or invalid messages array");
      return NextResponse.json(
        { error: "Missing or invalid messages parameter" },
        { status: 400 }
      );
    }

    if (!provider) {
      console.error("[ERROR] Missing provider");
      return NextResponse.json(
        { error: "Missing provider parameter" },
        { status: 400 }
      );
    }

    if (!apiKey) {
      console.error("[ERROR] Missing API key");
      return NextResponse.json(
        { error: "Missing API key" },
        { status: 400 }
      );
    }

    // Process messages to handle attachments
    const processedMessages = messages.map((message: any) => {
      // Handle messages with attachments
      if (message.attachments && message.attachments.length > 0) {
        // Extract text from attachments and add to message content
        const attachmentText = message.attachments
          .filter((att: any) => att.extractedText)
          .map((att: any) => `[File: ${att.name}]\n${att.extractedText}\n[End File]`)
          .join("\n\n");

        return {
          ...message,
          content: message.content + (attachmentText ? `\n\n${attachmentText}` : "")
        };
      }
      return message;
    });

    // Web search if enabled
    let searchResults = null;
    if (webSearchEnabled) {
      try {
        const query = processedMessages[processedMessages.length - 1].content;
        const userLocation = request.headers.get("x-user-location") || null;
        
        // Use enhanced web search if enabled
        if (enhancedWebSearch) {
          searchResults = await performEnhancedWebSearch(query, userLocation);
        } else {
          searchResults = await performWebSearch(query, userLocation);
        }
        
        if (searchResults && searchResults.length > 0) {
          // Add search results to the last system message or create a new one
          const searchResultsText = formatSearchResultsForAI(searchResults);
          
          // Add as a system message before the user's query
          processedMessages.splice(processedMessages.length - 1, 0, {
            role: "system",
            content: `Here are some web search results that might be helpful for answering the user's query:\n\n${searchResultsText}\n\nPlease use these results to help answer the user's question. Include relevant information from the search results, and cite the sources in your response.`
          });
        }
      } catch (error) {
        console.error("[ERROR] Web search error:", error);
        // Continue without search results rather than failing the request
      }
    }

    // Handle code generation if enabled
    if (codeGenerationEnabled) {
      try {
        // Get the base URL for the edge function
        const baseUrl = process.env.VERCEL_URL 
          ? `https://${process.env.VERCEL_URL}`
          : process.env.NEXT_PUBLIC_SITE_URL 
          ? process.env.NEXT_PUBLIC_SITE_URL
          : process.env.NODE_ENV === 'development'
          ? 'http://localhost:3000'
          : 'https://apeiron.app';

        const edgeFunctionUrl = `${baseUrl}/.netlify/functions/generate-code`;
        
        console.log("[DEBUG API] Using edge function URL:", edgeFunctionUrl);

        const codeResponse = await fetch(edgeFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            messages: processedMessages,
            provider,
            model,
            apiKey,
            temperature,
            customModelName
          })
        });

        if (!codeResponse.ok) {
          const errorText = await codeResponse.text();
          console.error("[ERROR] Code generation failed:", codeResponse.status, errorText);
          throw new Error(`Code generation failed: ${errorText}`);
        }

        // Handle streaming response
        const reader = codeResponse.body?.getReader();
        if (!reader) {
          throw new Error('No response body from code generation');
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let aiResponse = '';

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

        return NextResponse.json({ 
          success: true,
          response: aiResponse,
          model: model
        });
      } catch (error) {
        console.error("[ERROR] Code generation error:", error);
        throw error;
      }
    }

    // Process the request based on provider
    let response;
    let aiResponse = "";

    try {
      switch (provider.toLowerCase()) {
      case "openai":
        const openaiParams = getOptimizedParams(15000, 2500);
        const openaiMessages = optimizeMessagesForCode(processedMessages.map((m: any) => ({ role: m.role, content: m.content })));
          
          // Map model names to OpenAI API model names
          let openaiModel = model;
          if (model === "o3") openaiModel = "o3";
          if (model === "gpt-4.5") openaiModel = "gpt-4.5-turbo";
          if (model === "gpt-4.1") openaiModel = "gpt-4-turbo-2024-04-09";
        
        response = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
              model: openaiModel,
            messages: openaiMessages,
            temperature: openaiParams.temperature,
              max_tokens: openaiParams.maxTokens
          })
        }, openaiParams.timeout);

        if (!response.ok) {
          const errorData = await response.text();
            console.error("[ERROR] OpenAI error:", response.status, errorData);
            throw new Error(`OpenAI error (${response.status}): ${errorData}`);
        }

        const openaiData = await safeJsonParse(response, "OpenAI");
          aiResponse = cleanAIResponse(openaiData.choices[0]?.message?.content || "", "OpenAI");
        break;

      case "claude":
          const claudeParams = getOptimizedParams(15000, 2500);
        const claudeMessages = optimizeMessagesForCode(processedMessages.map((m: any) => ({ role: m.role, content: m.content })));
          
          // Map model names to Claude API model names
          let claudeModel = model;
          if (model === "claude-4-sonnet") claudeModel = "claude-3-5-sonnet-20240620";
          if (model === "claude-3.5-opus") claudeModel = "claude-3-5-opus-20240620";
          if (model === "claude-3.5-sonnet") claudeModel = "claude-3-5-sonnet-20240620";
        
        response = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
              model: claudeModel,
              messages: claudeMessages,
            temperature: claudeParams.temperature,
              max_tokens: claudeParams.maxTokens
          })
        }, claudeParams.timeout);

        if (!response.ok) {
          const errorData = await response.text();
            console.error("[ERROR] Claude error:", response.status, errorData);
            throw new Error(`Claude error (${response.status}): ${errorData}`);
        }

        const claudeData = await safeJsonParse(response, "Claude");
          aiResponse = cleanAIResponse(claudeData.content[0]?.text || "", "Claude");
        break;

        case "openrouter":
          try {
            console.log("[DEBUG API] Processing OpenRouter request");
            console.log("[DEBUG API] Model:", model);
            console.log("[DEBUG API] API key exists:", !!apiKey);
            
            if (!apiKey) {
              throw new Error("OpenRouter API key is required. Please enter your API key in settings.");
            }
            
            // Use a local variable for the model ID to avoid reassigning the parameter
            let openrouterModelId = model || "";
            if (!openrouterModelId) {
              console.warn("[WARN API] No OpenRouter model ID provided, using default");
              openrouterModelId = "anthropic/claude-3-sonnet";
            }
            
            const openrouterParams = getOptimizedParams(15000, 2500);
            
            // Validate and clean messages
            let openrouterMessages;
            try {
              openrouterMessages = optimizeMessagesForCode(processedMessages.map((m: any) => ({ role: m.role, content: m.content })));
              if (!openrouterMessages || openrouterMessages.length === 0) {
                throw new Error("No valid messages to send to OpenRouter");
              }
            } catch (msgError) {
              console.error("[ERROR API] Failed to process OpenRouter messages:", msgError);
              throw new Error("Failed to process messages for OpenRouter. Please try again.");
            }
            
            // For OpenRouter, use the model ID directly as it already includes the provider prefix
            // Make sure we have a properly formatted model ID (should contain a slash)
            if (!openrouterModelId.includes('/')) {
              // If no slash, try to determine the provider and format it
              console.log("[DEBUG API] Adding provider prefix to model ID:", openrouterModelId);
              if (openrouterModelId.includes('gpt')) {
                openrouterModelId = `openai/${openrouterModelId}`;
              } else if (openrouterModelId.includes('claude')) {
                openrouterModelId = `anthropic/${openrouterModelId}`;
              } else if (openrouterModelId.includes('gemini')) {
                openrouterModelId = `google/${openrouterModelId}`;
              } else if (openrouterModelId.includes('mistral')) {
                openrouterModelId = `mistral/${openrouterModelId}`;
              } else if (openrouterModelId.includes('llama')) {
                openrouterModelId = `meta-llama/${openrouterModelId}`;
        } else {
                console.warn("[WARN API] Could not determine provider for model:", openrouterModelId);
                // Continue with the model as-is
              }
            }
            
            console.log("[DEBUG API] Using OpenRouter model ID:", openrouterModelId);
            
            // Prepare request body with error handling
            let requestBody;
            try {
              console.log("[DEBUG API] Using final OpenRouter model ID:", openrouterModelId);
              requestBody = JSON.stringify({
                model: openrouterModelId,
                messages: openrouterMessages,
                temperature: openrouterParams.temperature,
                max_tokens: openrouterParams.maxTokens,
                stream: false
              });
            } catch (jsonError) {
              console.error("[ERROR API] Failed to stringify OpenRouter request:", jsonError);
              throw new Error("Failed to prepare OpenRouter request. Please try again.");
        }
        
        try {
              response = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
                  method: "POST",
                  headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${apiKey}`,
                  "HTTP-Referer": request.headers.get("referer") || "https://apeiron.app",
                  "X-Title": "Apeiron"
                },
                body: requestBody
              }, openrouterParams.timeout);
    
              console.log("[DEBUG API] OpenRouter response status:", response.status);
              
              if (!response.ok) {
                let errorMessage = "OpenRouter is currently unavailable. Please try again in a moment.";
                let errorData = "";
                
                try {
                  errorData = await response.text();
                  console.error("[ERROR API] OpenRouter error:", response.status, errorData);
                  
                  // Try to parse error data for more details
                  try {
                    const errorJson = JSON.parse(errorData);
                    if (errorJson.error && typeof errorJson.error === 'object' && errorJson.error.message) {
                      errorMessage = `OpenRouter error: ${errorJson.error.message}`;
                    } else if (errorJson.error && typeof errorJson.error === 'string') {
                      errorMessage = `OpenRouter error: ${errorJson.error}`;
                    }
                  } catch (parseError) {
                    // Continue with default error message if parsing fails
                  }
                } catch (textError) {
                  console.error("[ERROR API] Failed to read OpenRouter error response:", textError);
                }
                
                if (response.status === 504) {
                  errorMessage = "OpenRouter request timed out. Serverless time limit reached. Try a shorter request.";
                } else if (response.status === 401) {
                  errorMessage = "OpenRouter API key is invalid or expired. Please check your API key.";
                } else if (response.status === 404) {
                  errorMessage = "The selected OpenRouter model is not available. Please choose a different model.";
                } else if (response.status === 402) {
                  errorMessage = "OpenRouter credits exhausted. Please check your account balance.";
                }
                
                throw new Error(errorMessage);
              }
    
              // Parse response with error handling
              let openrouterData;
              try {
                openrouterData = await safeJsonParse(response, "OpenRouter");
                console.log("[DEBUG API] OpenRouter response received successfully");
              } catch (parseError) {
                console.error("[ERROR API] Failed to parse OpenRouter response:", parseError);
                throw new Error("Failed to parse OpenRouter response. Please try again.");
              }
              
              // Extract and validate response content
              try {
                if (!openrouterData.choices || !openrouterData.choices[0] || !openrouterData.choices[0].message) {
                  console.error("[ERROR API] Invalid OpenRouter response format:", openrouterData);
                  throw new Error("OpenRouter returned an invalid response format. Please try again.");
                }
                
                aiResponse = cleanAIResponse(openrouterData.choices[0].message.content || "", "OpenRouter");
                if (!aiResponse) {
                  throw new Error("OpenRouter returned an empty response. Please try again.");
                }
              } catch (contentError) {
                console.error("[ERROR API] Failed to extract OpenRouter response content:", contentError);
                throw new Error("Failed to extract OpenRouter response. Please try again.");
              }
            } catch (error) {
              const fetchError = error as Error;
              console.error("[ERROR API] OpenRouter fetch error:", fetchError);
              
              // Provide more specific error messages for common fetch errors
              if (fetchError.message && fetchError.message.includes("timed out")) {
                throw new Error("OpenRouter request timed out. Please try again with a shorter message.");
              } else if (fetchError.message && (fetchError.message.includes("Failed to fetch") || fetchError.message.includes("Network error"))) {
                throw new Error("Network error while connecting to OpenRouter. Please check your internet connection.");
              }
              
              throw fetchError;
            }
          } catch (openrouterError) {
            console.error("[ERROR API] OpenRouter processing error:", openrouterError);
            throw openrouterError;
          }
          break;
          
        case "gemini":
          const geminiParams = getOptimizedParams(15000, 2500);
          
          // Format messages for Gemini API
          const geminiMessages = optimizeMessagesForCode(processedMessages).map((m: any) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }]
          }));
          
          // Map model names to Gemini API model names
          let geminiModel = "gemini-pro";
          if (model.includes("2.5-flash")) geminiModel = "gemini-1.5-flash";
          else if (model.includes("2.5-pro")) geminiModel = "gemini-1.5-pro";
          
          response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`, {
                method: "POST",
                headers: {
              "Content-Type": "application/json"
                },
                body: JSON.stringify({
              contents: geminiMessages,
              generationConfig: {
                temperature: geminiParams.temperature,
                maxOutputTokens: geminiParams.maxTokens
              }
            })
          }, geminiParams.timeout);

        if (!response.ok) {
          const errorData = await response.text();
            console.error("[ERROR] Gemini error:", response.status, errorData);
            throw new Error(`Gemini error (${response.status}): ${errorData}`);
          }
          
          const geminiData = await safeJsonParse(response, "Gemini");
          
          // Extract response from Gemini's format
          if (!geminiData.candidates || !geminiData.candidates[0] || !geminiData.candidates[0].content) {
            throw new Error("Invalid response format from Gemini");
          }
          
          const candidateContent = geminiData.candidates[0].content;
          if (!candidateContent.parts || !candidateContent.parts[0] || !candidateContent.parts[0].text) {
            throw new Error("Missing text content in Gemini response");
          }
          
          aiResponse = cleanAIResponse(candidateContent.parts[0].text, "Gemini");
        break;

      case "mistral":
        const mistralParams = getOptimizedParams(15000, 2500);
        const mistralMessages = optimizeMessagesForCode(processedMessages.map((m: any) => ({ role: m.role, content: m.content })));
        
        // Map model names to Mistral API model names
        let mistralModel = "mistral-large-latest";
          if (model.includes("medium")) mistralModel = "mistral-medium-latest";
        else if (model.includes("small")) mistralModel = "mistral-small-latest";
        else if (model.includes("codestral")) mistralModel = "codestral-latest";
        
        response = await fetchWithTimeout("https://api.mistral.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: mistralModel,
            messages: mistralMessages,
            temperature: mistralParams.temperature,
              max_tokens: mistralParams.maxTokens
          })
        }, mistralParams.timeout);

        if (!response.ok) {
          const errorData = await response.text();
            console.error("[ERROR] Mistral error:", response.status, errorData);
            throw new Error(`Mistral error (${response.status}): ${errorData}`);
        }

        const mistralData = await safeJsonParse(response, "Mistral");
          aiResponse = cleanAIResponse(mistralData.choices[0]?.message?.content || "", "Mistral");
        break;

      default:
          return NextResponse.json(
            { error: `Unsupported provider: ${provider}` },
            { status: 400 }
          );
    }

      // Return the AI response
    return NextResponse.json({
      response: aiResponse,
        searchResults: searchResults
      }, { 
        status: 200, 
        headers: { "Content-Type": "application/json" } 
    });

  } catch (error) {
      console.error("[ERROR] Error processing request:", error);
    return NextResponse.json(
      { 
          error: error instanceof Error ? error.message : "An unknown error occurred" 
        },
        { 
          status: 500, 
          headers: { "Content-Type": "application/json" } 
        }
      );
    }
  } catch (outerError) {
    // Catch any unhandled errors in the outer scope
    console.error("[ERROR] Unhandled error in POST handler:", outerError);
    return NextResponse.json(
      { 
        error: outerError instanceof Error ? outerError.message : "A critical error occurred" 
      },
      { 
        status: 500, 
        headers: { "Content-Type": "application/json" } 
      }
    );
  }
}