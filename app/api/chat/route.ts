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

// API Route optimized for serverless environments (Netlify/Vercel)
// Timeouts are kept under 25 seconds due to serverless function limits
export async function POST(request: NextRequest) {
  // Set up timeout to handle long-running requests
  const emergencyTimeout = setTimeout(() => {
    console.error("Emergency timeout triggered - request took too long");
  }, 58000); // Just under Vercel's 60s limit
  
  let provider = "unknown"; // Declare outside try block for error handling
  let model = "unknown"; // Declare outside try block for error handling
  let isCodeRequest = false; // Declare outside try block for error handling
  
  try {
    const requestBody: ChatRequestBody = await request.json();
    
    // Initialize request type flags
    isCodeRequest = false;
    let isImageRequest: boolean = false;
    
    // Log the full request body for debugging
    console.log('Chat API Request Body:', JSON.stringify({
      messageCount: requestBody.messages?.length,
      model: requestBody.model,
      provider: requestBody.provider,
      firstMessageContent: requestBody.messages?.[0]?.content?.substring(0, 50),
      lastMessageContent: requestBody.messages?.[requestBody.messages.length - 1]?.content?.substring(0, 50),
      lastMessageHasAttachments: !!requestBody.messages?.[requestBody.messages.length - 1]?.attachments,
      lastMessageAttachmentsCount: requestBody.messages?.[requestBody.messages.length - 1]?.attachments?.length || 0,
      firstAttachment: requestBody.messages?.[requestBody.messages.length - 1]?.attachments?.[0] ? {
        type: requestBody.messages[requestBody.messages.length - 1].attachments[0].type,
        hasUrl: !!requestBody.messages[requestBody.messages.length - 1].attachments[0].url,
        urlPrefix: requestBody.messages[requestBody.messages.length - 1].attachments[0].url?.substring(0, 30)
      } : 'no attachments'
    }, null, 2));
    
    const {
      messages,
      model: requestModel,
      provider: requestProvider,
      apiKey,
      geminiApiKey,
      openaiApiKey,
      runwayApiKey,
      customModelName,
      webSearchEnabled,
      enhancedWebSearch,
      codeGenerationEnabled,
      temperature,
      userLocation,
      retryCount = 0
    } = requestBody;
    
    provider = requestProvider; // Assign to outer scope variable
    model = requestModel; // Assign to outer scope variable

    // Validate required inputs
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.error("Invalid messages:", messages);
      return NextResponse.json(
        { error: "Messages array is required and must not be empty" },
        { status: 400 }
      );
    }

    if (!provider || typeof provider !== 'string') {
      console.error("Invalid provider:", provider);
      return NextResponse.json(
        { error: "Valid provider is required" },
        { status: 400 }
      );
    }

    if (!model || typeof model !== 'string') {
      console.error("Invalid model:", model);
      return NextResponse.json(
        { error: "Valid model is required" },
        { status: 400 }
      );
    }

    if (!apiKey || typeof apiKey !== 'string') {
      console.error("Invalid API key for provider:", provider);
      return NextResponse.json(
        { error: "Valid API key is required" },
        { status: 400 }
      );
    }

    // Convert flags to boolean using strict helper
    const isWebSearchEnabled = toBooleanStrict(webSearchEnabled);
    const isEnhancedWebSearch = toBooleanStrict(enhancedWebSearch);
    const isCodeGenerationEnabled = toBooleanStrict(codeGenerationEnabled);

    // Check if the last user message has image attachments
    const lastUserMessage = messages.length > 0 ? messages[messages.length - 1] : null;
    const hasImageAttachments = Boolean(lastUserMessage && 
      lastUserMessage.role === 'user' && 
      lastUserMessage.attachments && 
      Array.isArray(lastUserMessage.attachments) && 
      lastUserMessage.attachments.some((att: Attachment) => {
        return !!att.type && 
               typeof att.type === 'string' && 
               att.type.startsWith('image/') &&
               !!att.url;
      }));
    
    // Log details about the last message and its attachments
    if (lastUserMessage && lastUserMessage.attachments && Array.isArray(lastUserMessage.attachments)) {
      console.log('Last message with attachments:', JSON.stringify({
        role: lastUserMessage.role,
        content: typeof lastUserMessage.content === 'string' ? lastUserMessage.content.substring(0, 50) : 'non-string content',
        attachmentsCount: lastUserMessage.attachments.length,
        hasImageAttachments: hasImageAttachments,
        firstAttachment: lastUserMessage.attachments[0] ? {
          id: lastUserMessage.attachments[0].id,
          name: lastUserMessage.attachments[0].name,
          type: lastUserMessage.attachments[0].type,
          hasUrl: !!lastUserMessage.attachments[0].url,
          urlPrefix: lastUserMessage.attachments[0].url ? lastUserMessage.attachments[0].url.substring(0, 30) : 'no-url'
        } : 'no-attachments'
      }, null, 2));
    }
    
    console.log(`Last message has image attachments: ${hasImageAttachments}`);
    
    // Process messages based on provider and attachments
    let processedMessages = [...messages]; // Default to original messages

    // If there are image attachments, format them according to each provider's requirements
    if (hasImageAttachments) {
      console.log(`Processing image attachments for provider: ${provider}`);
      
      // We already know the last message has image attachments
      const lastUserMessageIndex = messages.length - 1;
      const userMessage = messages[lastUserMessageIndex];
      
      console.log('Processing last message with attachments:', {
        role: userMessage.role,
        hasAttachments: !!userMessage.attachments,
        attachmentsLength: userMessage.attachments?.length,
        content: userMessage.content?.substring(0, 50)
      });
      
      // Filter to only include image attachments
      const imageAttachments = userMessage.attachments.filter((att: any) => att.type?.startsWith('image/'));
      
      if (imageAttachments.length > 0) {
        console.log(`Found ${imageAttachments.length} image attachments in message`);
        
        // Format based on provider
        switch(provider.toLowerCase()) {
          case 'openai':
            // Format for OpenAI's vision models
            processedMessages = messages.map((msg, i) => {
              if (i === lastUserMessageIndex) {
                // Convert to OpenAI's vision format
                const contentParts = [];
                
                // Add text content if it exists
                if (msg.content && typeof msg.content === 'string') {
                  contentParts.push({ 
                    type: "text", 
                    text: msg.content 
                  });
                }
                
                // Add image attachments
                imageAttachments.forEach((img: any) => {
                  if (img.url) {
                    try {
                      console.log('Processing image for OpenAI:', img.type, img.url.substring(0, 50));
                      
                      // OpenAI supports both data URLs and external URLs
                      contentParts.push({
                        type: "image_url",
                        image_url: {
                          url: img.url
                        }
                      });
                      
                      console.log('Successfully added image to OpenAI message');
                    } catch (e) {
                      console.error('Failed to process image for OpenAI:', e);
                    }
                  }
                });
                
                return {
                  ...msg,
                  content: contentParts
                };
              }
              return msg;
            });
            console.log('Processed messages for OpenAI vision');
            break;
            
          case 'claude':
            // Format for Claude's vision models
            processedMessages = messages.map((msg, i) => {
              if (i === lastUserMessageIndex) {
                // Convert to Claude's vision format
                const contentParts = [];
                
                // Add text content if it exists
                if (msg.content && typeof msg.content === 'string') {
                  contentParts.push({ 
                    type: "text", 
                    text: msg.content 
                  });
                }
                
                // Add image attachments
                imageAttachments.forEach((img: any) => {
                  if (img.url) {
                    try {
                      console.log('Processing image for Claude:', img.type, img.url.substring(0, 50));
                      
                      let base64Data = '';
                      let mimeType = img.type || 'image/jpeg';
                      
                      // Handle data URLs
                      if (img.url.startsWith('data:')) {
                        const [header, data] = img.url.split(',');
                        if (header && data) {
                          // Extract mime type if available in the data URL
                          const mimeMatch = header.match(/data:(.*?);/);
                          if (mimeMatch && mimeMatch[1]) {
                            mimeType = mimeMatch[1];
                          }
                          base64Data = data;
                        } else {
                          throw new Error('Invalid data URL format');
                        }
                      } 
                      // Handle raw base64 data
                      else if (img.url.match(/^[A-Za-z0-9+/=]+$/)) {
                        base64Data = img.url;
                      }
                      // Handle external URLs - not supported by Claude
                      else {
                        throw new Error('Claude only supports base64 image data, not external URLs');
                      }

                      if (!base64Data) {
                        throw new Error('Failed to extract image data');
                      }

                      contentParts.push({
                        type: "image",
                        source: {
                          type: "base64",
                          media_type: mimeType,
                          data: base64Data
                        }
                      });
                      
                      console.log('Successfully added image to Claude message');
                    } catch (e) {
                      console.error('Failed to process image for Claude:', e);
                      throw new Error('Failed to process image for Claude. Please ensure the image is in a supported format.');
                    }
                  }
                });
                
                return {
                  ...msg,
                  content: contentParts
                };
              }
              return msg;
            });
            console.log('Processed messages for Claude vision');
            break;
            
          case 'gemini':
            // Format for Gemini's vision models
            const geminiMessages = [];
            
            // Add previous messages (excluding the last user message)
            for (let i = 0; i < lastUserMessageIndex; i++) {
              const msg = messages[i];
              geminiMessages.push({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }]
              });
            }
            
            // Add the last user message with images
            const lastUserMsg = messages[lastUserMessageIndex];
            const geminiParts = [];
            
            // Add text content if it exists
            if (lastUserMsg.content && typeof lastUserMsg.content === 'string') {
              geminiParts.push({ text: lastUserMsg.content });
            }
            
            // Add image attachments
            imageAttachments.forEach((img: any) => {
              if (img.url) {
                try {
                  console.log('Processing image for Gemini:', img.type, img.url.substring(0, 50));
                  
                  let mimeType = img.type || 'image/jpeg';
                  let imageData = img.url;
                  
                  // Handle data URLs by extracting the base64 part
                  if (img.url.startsWith('data:')) {
                    const [header, data] = img.url.split(',');
                    if (header && data) {
                      // Extract mime type if available in the data URL
                      const mimeMatch = header.match(/data:(.*?);/);
                      if (mimeMatch && mimeMatch[1]) {
                        mimeType = mimeMatch[1];
                      }
                      imageData = data; // Just the base64 part for inline_data
                    }
                  }
                  
                  geminiParts.push({
                    inline_data: {
                      mime_type: mimeType,
                      data: imageData
                    }
                  });
                  
                  console.log('Successfully added image to Gemini message');
                } catch (e) {
                  console.error('Failed to process image for Gemini:', e);
                }
              }
            });
            
            geminiMessages.push({
              role: 'user',
              parts: geminiParts
            });
            
            // Set the processed messages for Gemini
            processedMessages = geminiMessages;
            console.log('Processed messages for Gemini vision');
            break;
            
          default:
            // For other providers, enhance the text prompt
            processedMessages = messages.map((msg, i) => {
              if (i === lastUserMessageIndex) {
                let enhancedContent = msg.content || '';
                
                // Add image context to the prompt
                if (imageAttachments.length === 1) {
                  enhancedContent = `[Image attached] ${enhancedContent}`;
                } else {
                  enhancedContent = `[${imageAttachments.length} images attached] ${enhancedContent}`;
                }
                
                return {
                  ...msg,
                  content: enhancedContent
                };
              }
              return msg;
            });
            console.log(`Enhanced text prompt for provider: ${provider}`);
        }
      }
    }

    // Validate model matches provider
    const modelProvider = getModelProvider(model);
    if (modelProvider !== provider) {
      console.error(`Model ${model} does not match provider ${provider}`);
      return NextResponse.json(
        { error: `Model ${model} cannot be used with provider ${provider}. Please select a compatible model.` },
        { status: 400 }
      );
    }

    let response;
    let aiResponse = "";
    let searchResults = null;
    let isRetry: boolean = false;

    // Helper function to add timeout to fetch requests
    const fetchWithTimeout = async (url: string, options: any, timeoutMs: number = 18000): Promise<Response> => {
      // Allow longer timeouts for edge functions (up to 90s), and increase timeout for code generation
      const isEdgeFunction = url.includes('/.netlify/edge-functions/');
      const isGemini25Pro = model.includes('2.5-pro') && provider === 'gemini';
      const maxTimeout = isEdgeFunction ? 90000 : 
                         isGemini25Pro ? 50000 :
                         (isCodeRequest && !isRetry) ? 40000 : 30000;
      const safeTimeout = Math.min(timeoutMs, maxTimeout);
      
      console.log(`Setting timeout for request: ${safeTimeout}ms (${isGemini25Pro ? 'Gemini 2.5 Pro' : isEdgeFunction ? 'Edge Function' : 'Standard'})`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), safeTimeout);

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          const errorMsg = isEdgeFunction 
            ? `Edge function timed out after ${safeTimeout / 1000} seconds. Try a shorter request.`
            : `Request timed out after ${safeTimeout / 1000} seconds. ${isCodeRequest && !isRetry ? 'Code generation can take longer - try breaking complex requests into smaller parts.' : 'Serverless functions have strict time limits. Try a shorter request.'}`;
          isRetry = true; // Mark as retry for subsequent attempts
          throw new Error(errorMsg);
        }
        throw error;
      }
    };

    // Detect if this is a code generation request
    try {
      const lastMessageContent = typeof processedMessages[processedMessages.length - 1]?.content === 'string' 
        ? processedMessages[processedMessages.length - 1]?.content?.toLowerCase() || ""
        : "";
      
      // Check if this is a retry by looking at message history
      isRetry = processedMessages.length > 1 && processedMessages.some(m => 
        m.role === 'assistant' && 
        typeof m.content === 'string' && 
        m.content.includes('Try Again')
      );

      // If there are image attachments, disable code generation detection
      if (hasImageAttachments === true) {
        isCodeRequest = false;
        console.log("Image attachments detected - disabling code generation detection");
      }
      // Only check for code patterns if codeGenerationEnabled is EXPLICITLY true and no image attachments
      else if (toBooleanStrict(codeGenerationEnabled) === true && !isRetry) {
        // Enhanced code detection patterns
        const codePatterns = [
          /create.*(?:website|web.*page|html.*page|landing.*page)/i,
          /build.*(?:app|application|website|component)/i,
          /generate.*(?:code|script|function|class|component)/i,
          /write.*(?:code|script|function|program)/i,
          /make.*(?:website|app|component|function)/i,
          /develop.*(?:website|app|application)/i,
          /code.*(?:for|to|that)/i,
          /html.*css/i,
          /javascript.*function/i,
          /react.*component/i,
          /vue.*component/i,
          /angular.*component/i,
          /python.*script/i,
          /node.*js/i,
          /create.*api/i,
          /build.*dashboard/i,
          /design.*interface/i
        ];
        
        isCodeRequest = Boolean(codePatterns.some(pattern => pattern.test(lastMessageContent)));
        console.log("Code generation enabled and patterns matched:", isCodeRequest);
      } else {
        isCodeRequest = false;
        console.log("Code generation disabled or retry request");
      }
      
      // Enhanced image detection patterns
      const imagePatterns = [
        /generate.*(?:image|picture|photo|artwork|illustration)/i,
        /create.*(?:image|picture|photo|artwork|illustration|visual)/i,
        /draw.*(?:image|picture|illustration)/i,
        /make.*(?:image|picture|photo|artwork)/i,
        /design.*(?:image|logo|icon|graphic)/i,
        /paint.*(?:image|picture|artwork)/i,
        /sketch.*(?:image|drawing)/i,
        /render.*(?:image|artwork)/i,
        /visualize.*(?:image|concept)/i,
        /show.*me.*(?:image|picture|visual)/i,
        /can.*you.*(?:draw|create|generate|make).*(?:image|picture)/i
      ];
      
      // Check if model is an image/video generation model
      const isImageModel = Boolean(model && (model.includes('gen3') || model.includes('gen2')));
      
      // Check for image generation request
      isImageRequest = Boolean(imagePatterns.some(pattern => pattern.test(lastMessageContent)) || isImageModel);
      
      // If image attachments are present, prioritize vision model handling for all providers
      if (hasImageAttachments === true) {
        console.log("Image attachments detected - prioritizing vision model handling for all providers");
      }
      
      console.log("Request analysis:", { 
        isCodeRequest: toBooleanStrict(isCodeRequest), 
        isImageRequest: toBooleanStrict(isImageRequest), 
        isImageModel: toBooleanStrict(isImageModel), 
        model, 
        codeGenerationEnabled: toBooleanStrict(isCodeGenerationEnabled),
        hasImageAttachments,
        lastMessage: lastMessageContent?.substring(0, 100) 
      });
    } catch (error) {
      console.error("Error in request detection:", error);
      isCodeRequest = false;
      isImageRequest = false;
    }

    // Route code generation requests to Edge Function for better performance (both dev and production)
    if (isCodeRequest === true) {
      try {
        console.log('Routing code generation request to edge function for optimal performance');
        const edgeFunctionUrl = `${new URL(request.url).origin}/api/generate-code`;
        
        const edgeResponse = await fetchWithTimeout(edgeFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: processedMessages,
            provider,
            apiKey,
            model,
            temperature,
            customModelName
          })
        }, 120000); // 2 minute timeout for edge function (allows more time for quality code generation)

        if (!edgeResponse.ok) {
          const errorText = await edgeResponse.text().catch(() => 'Unknown error');
          console.error(`Edge function failed with status ${edgeResponse.status}:`, errorText);
          throw new Error(`Edge function error (${edgeResponse.status}): ${errorText}`);
        }

        const edgeResult = await edgeResponse.json();
        
        // Validate edge function response has content
        if (!edgeResult.response && !edgeResult.content) {
          throw new Error('Edge function returned empty response');
        }
        
        clearTimeout(emergencyTimeout);
        
        // Ensure we have a consistent response format
        return NextResponse.json({
          content: edgeResult.response || edgeResult.content,
          response: edgeResult.response || edgeResult.content,
          model: edgeResult.model || model,
          provider: edgeResult.provider || provider,
          codeGeneration: true,
          edgeFunction: true,
          searchResults: null
        });
        
      } catch (edgeError) {
        console.error('Edge function failed, falling back to serverless:', edgeError);
        // Continue with regular serverless processing as fallback
      }
    }

    // Route image generation requests to dedicated image API
    if (isImageRequest) {
      try {
        console.log('Routing image generation request to image API');
        const imageApiUrl = `${new URL(request.url).origin}/api/generate-image`;
        
        const prompt = processedMessages[processedMessages.length - 1]?.content || "";
        
        // Prepare headers with API keys for the image generation API
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        
        // Add API keys as headers based on available keys
        if (geminiApiKey) {
          headers['x-gemini-api-key'] = geminiApiKey;
        }
        if (runwayApiKey) {
          headers['x-runway-api-key'] = runwayApiKey;
        }
        if (openaiApiKey) {
          headers['x-openai-api-key'] = openaiApiKey;
        }
        
        const imageResponse = await fetchWithTimeout(imageApiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            prompt: prompt,
            model: model
          })
        }, 30000); // 30 second timeout for image generation

        if (!imageResponse.ok) {
          const errorText = await imageResponse.text().catch(() => 'Unknown error');
          console.error(`Image generation failed with status ${imageResponse.status}:`, errorText);
          throw new Error(`Image generation error (${imageResponse.status}): ${errorText}`);
        }

        const imageResult = await imageResponse.json();
        
        if (!imageResult.imageUrl) {
          throw new Error('Image generation returned no image URL');
        }
        
        // Format the response with image information
        const imageResponseText = `🎨 **Image Generation Complete**

**Prompt:** ${prompt}

**Provider:** ${imageResult.provider}

**Model:** ${imageResult.model || model}

**Image URL:** ${imageResult.imageUrl}

**Status:** Generated successfully

Your image has been generated and is displayed above. You can download it using the download button.`;
        
        clearTimeout(emergencyTimeout);
        
        return NextResponse.json({
          content: imageResponseText,
          response: imageResponseText,
          model: imageResult.model || model,
          provider: imageResult.provider,
          imageGeneration: true,
          imageUrl: imageResult.imageUrl,
          searchResults: null
        });

      } catch (error) {
        console.error(`Image generation failed:`, error);
        // Fall through to regular chat response with error message
        const errorMessage = error instanceof Error ? error.message : "Image generation failed";
        const fallbackResponse = `I apologize, but I encountered an error while trying to generate an image: ${errorMessage}. 

I can still help you with text-based responses. Would you like me to describe what the image might look like instead, or help you with something else?`;
        
        clearTimeout(emergencyTimeout);
        
        return NextResponse.json({
          content: fallbackResponse,
          response: fallbackResponse,
          model: model,
          provider: provider,
          isError: true,
          searchResults: null
        });
      }
    }

    // Optimize parameters for code generation
    const getOptimizedParams = (baseTimeout: number, baseTokens: number) => {
      try {
        if (isCodeRequest || isCodeGenerationEnabled) {
          return {
            timeout: Math.min(baseTimeout + 15000, 35000), // Add 15 seconds for code, max 35s (increased from 30s)
            maxTokens: Math.min(baseTokens * 2, 8000), // 2x tokens for code, max 8000
            temperature: 0.1 // Lower temperature for more focused code output
          };
        }
        return {
          timeout: baseTimeout,
          maxTokens: baseTokens,
          temperature: temperature || 0.7
        };
      } catch (error) {
        console.error("Error in parameter optimization:", error);
        // Fallback to safe defaults
        return {
          timeout: baseTimeout,
          maxTokens: baseTokens,
          temperature: temperature || 0.7
        };
      }
    };

    // Clean and optimize messages for API requests
    const optimizeMessagesForCode = (messages: any[]) => {
      try {
        if (!Array.isArray(messages) || messages.length === 0) {
          return messages;
        }
        
        // Filter and clean messages
        const cleanedMessages = messages
          .filter((m: any) => {
            // Remove messages with empty or invalid content
            return m && m.role && m.content && typeof m.content === 'string' && m.content.trim().length > 0;
          })
          .map((m: any) => ({
            role: m.role,
            content: m.content.trim()
          }));
        
        // Ensure we have at least one message
        if (cleanedMessages.length === 0) {
          return [{ role: "user", content: "Hello" }];
        }
        
        // Add code generation instructions if this is a code request
        if ((isCodeRequest || isCodeGenerationEnabled) && cleanedMessages.length > 0) {
          const lastMessage = cleanedMessages[cleanedMessages.length - 1];
          if (lastMessage.role === "user") {
            lastMessage.content = `EXPERT CODE GENERATION MODE:

You are an expert developer. Generate high-quality, production-ready code based on this request:

"${lastMessage.content}"

REQUIREMENTS:
- Generate complete, working code that runs immediately
- Use modern best practices and clean architecture
- Include comprehensive styling for web projects (CSS/HTML)
- Add meaningful comments and documentation
- Ensure responsive design for web interfaces
- Follow security best practices
- Make it visually appealing with excellent UX/UI
- Include all necessary dependencies and imports
- Provide complete file structure when needed

OUTPUT FORMAT:
- Use proper code blocks with language specification
- For web projects, provide complete HTML with embedded CSS
- Include JavaScript functionality when appropriate
- Ensure all code is properly formatted and indented

Generate the complete solution now:`;
          }
        }
        
        return cleanedMessages;
      } catch (error) {
        console.error("Error in message optimization:", error);
        // Return a safe fallback
        return [{ role: "user", content: "Hello" }];
      }
    };

    // Perform web search if enabled for compatible models (Gemini and Grok)
    if (isWebSearchEnabled && (provider === "gemini" || provider === "grok")) {
      const lastMessage = processedMessages[processedMessages.length - 1];
      if (lastMessage && lastMessage.role === "user") {
        try {
          // Extract user location from request if available
          const userLocation = request.headers.get('x-user-location') || null;
          
          const searchResponse = await fetchWithTimeout(`${new URL(request.url).origin}/api/web-search`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: lastMessage.content,
              maxResults: 5,
              userLocation,
              extractContent: isEnhancedWebSearch // Use enhanced search flag for content extraction
            })
          }, isEnhancedWebSearch ? 25000 : 15000); // Increased timeout for enhanced search

          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            searchResults = searchData.results;
            
            // Enhance the user's message with search context
            // Use extracted content when available for better context
            const searchContext = searchResults.map((result: any, index: number) => {
              // Use extracted content if available, otherwise use snippet
              const contentSection = result.extractedContent 
                ? `Content: ${result.extractedContent.substring(0, 1000)}${result.extractedContent.length > 1000 ? '...' : ''}`
                : `Snippet: ${result.snippet}`;
                
              return `[${index + 1}] Title: ${result.extractedTitle || result.title}
URL: ${result.url}
Source: ${result.source || 'Unknown'}
${contentSection}`;
            }).join('\n\n');
            
            const enhancedContent = `User Query: ${lastMessage.content}

REAL-TIME WEB SEARCH RESULTS (Use this information to answer the query):
${searchContext}

INSTRUCTIONS:
- Base your response ONLY on the web search results provided above
- Analyze the content from the search results and provide a comprehensive summary
- Extract the most relevant information from each source to answer the query
- Include specific information, facts, and data from the search results
- Cite sources using the format [1], [2], etc. referring to the numbered sources above
- Provide clickable links in your response using markdown format [Link Text](URL)
- If the search results don't contain enough information to fully answer the query, say so explicitly
- Do NOT provide generic information not found in the search results
- Focus on the most relevant and reliable sources
- Ignore any search results that seem irrelevant to the query
- Prioritize sources from established websites and publications
- Ensure your response is coherent and directly addresses the user's query
- If search results are in different languages, focus on the English ones

Please provide a comprehensive response using the above search results.`;

            // Update the last message with search context
            processedMessages[processedMessages.length - 1] = {
              ...lastMessage,
              content: enhancedContent
            };
          } else {
            console.error("Web search API returned error:", await searchResponse.text());
          }
        } catch (searchError) {
          console.error("Web search failed:", searchError);
          // Continue without search results
        }
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
        console.error(`${providerName} JSON parse error:`, parseError);
        console.error(`${providerName} response text (first 500 chars):`, text.substring(0, 500));
        
        // Try to extract any meaningful content from the response
        if (text.includes('"content"') || text.includes('"text"') || text.includes('"message"')) {
          // This looks like it might be a partial JSON response
          throw new Error(`${providerName} returned a partial response. This often happens with very long code outputs. Please try with a smaller request or retry.`);
        }
        
        throw new Error(`${providerName} returned an invalid response format. Please try again.`);
      }
    };

    // Helper function to validate and clean AI responses, especially for code
    const cleanAIResponse = (response: string, providerName: string): string => {
      if (!response || typeof response !== 'string') {
        console.error(`${providerName} returned invalid response type:`, typeof response, response);
        return `I apologize, but ${providerName} returned an invalid response. Please try again with a different request.`;
      }
      
      // Ensure the response is properly terminated (not cut off)
      const trimmed = response.trim();
      if (trimmed.length === 0) {
        console.error(`${providerName} returned empty response`);
        return `I apologize, but ${providerName} returned an empty response. This often happens with very long requests. Please try with a shorter or simpler request.`;
      }
      
      return trimmed;
    };

    switch (provider) {
      case "openai":
        const openaiParams = getOptimizedParams(15000, 2500);
        const openaiMessages = optimizeMessagesForCode(processedMessages.map((m: any) => ({ role: m.role, content: m.content })));
        
        response = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model.includes("gpt-3.5") ? "gpt-3.5-turbo" : "gpt-4o",
            messages: openaiMessages,
            temperature: openaiParams.temperature,
            max_tokens: openaiParams.maxTokens,
            stream: false
          })
        }, openaiParams.timeout);

        if (!response.ok) {
          const errorData = await response.text();
          if (response.status === 504) {
            throw new Error(`OpenAI request timed out. Serverless time limit reached. Try a shorter request.`);
          }
          throw new Error(`OpenAI is currently unavailable (${response.status}). Please try again in a moment.`);
        }

        const openaiData = await safeJsonParse(response, "OpenAI");
        aiResponse = cleanAIResponse(openaiData.choices[0]?.message?.content || "OpenAI didn't provide a response. Please try again.", "OpenAI");
        break;

      case "claude":
        const claudeParams = getOptimizedParams(15000, 3000);
        const claudeMessages = optimizeMessagesForCode(processedMessages.map((m: any) => ({ role: m.role, content: m.content })));
        
        response = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: "claude-3-opus-20240229",
            max_tokens: claudeParams.maxTokens,
            temperature: claudeParams.temperature,
            messages: claudeMessages
          })
        }, claudeParams.timeout);

        if (!response.ok) {
          const errorData = await response.text();
          if (response.status === 504) {
            throw new Error(`Claude request timed out. Serverless time limit reached. Try a shorter request.`);
          }
          throw new Error(`Claude is currently unavailable (${response.status}). Please try again in a moment.`);
        }

        const claudeData = await safeJsonParse(response, "Claude");
        aiResponse = cleanAIResponse(claudeData.content[0]?.text || "Claude didn't provide a response. Please try again.", "Claude");
        break;

      case "gemini":
        // Increase timeout for Gemini, especially for code generation or image processing
        let geminiBaseTimeout = isCodeRequest || isCodeGenerationEnabled ? 25000 : 15000; // 25s for code, 15s for regular
        
        // Increase timeout for Gemini 2.5 Pro regardless of request type
        if (model.includes("2.5-pro")) {
          geminiBaseTimeout = 45000; // 45s for 2.5 Pro
          console.log(`Increased timeout for Gemini 2.5 Pro: ${geminiBaseTimeout}ms`);
        }
        // Increase timeout for image processing for other models
        else if (hasImageAttachments === true) {
          geminiBaseTimeout = 20000; // 20s for other models with images
          console.log(`Increased timeout for Gemini image processing: ${geminiBaseTimeout}ms`);
        }
        const geminiParams = getOptimizedParams(geminiBaseTimeout, 3000);
        
        // Check if we have pre-formatted Gemini messages with images
        let geminiMessages;
        
        // If the processedMessages are already in Gemini format with parts array
        if (hasImageAttachments === true && 
            Array.isArray(processedMessages) && 
            processedMessages.length > 0 && 
            processedMessages[0].parts) {
          console.log('Using pre-formatted Gemini messages with images');
          
          // Debug log to check the structure of image messages
          if (model.includes("2.5-pro")) {
            console.log('Gemini 2.5 Pro image message format:', 
              JSON.stringify({
                messageCount: processedMessages.length,
                firstMessageFormat: processedMessages[0].parts ? typeof processedMessages[0].parts[0] : 'unknown',
                partsCount: processedMessages[0].parts?.length || 0,
                hasImagePart: processedMessages[0].parts?.some((p: any) => p.inline_data) || false
              })
            );
          }
          
          geminiMessages = processedMessages;
        } else {
          // Clean messages first, then convert to Gemini format
          const cleanedGeminiMessages = optimizeMessagesForCode(processedMessages);
          geminiMessages = cleanedGeminiMessages.map((m: any) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }]
          }));
        }
        
        // Use correct Gemini 2.5 model names
        let geminiModel = "gemini-1.5-pro"; // Default fallback
        if (model.includes("2.5-flash")) {
          geminiModel = "gemini-2.5-flash-preview-05-20"; // Correct 2.5 Flash model name
        } else if (model.includes("2.5-pro")) {
          geminiModel = "gemini-2.5-pro-preview-06-05"; // Correct 2.5 Pro model name
          console.log("Using Gemini 2.5 Pro model:", geminiModel);
          console.log("Gemini 2.5 Pro request details:", {
            hasImageAttachments,
            messageCount: geminiMessages.length,
            firstMessageType: geminiMessages[0]?.parts ? typeof geminiMessages[0].parts[0] : 'unknown'
          });
        }
        
        try {
          console.log(`Calling Gemini API with model: ${geminiModel}, timeout: ${geminiBaseTimeout}ms`);
          
          // Special handling for Gemini 2.5 Pro
          if (model.includes("2.5-pro")) {
            console.log("Using enhanced error handling for Gemini 2.5 Pro");
            try {
              response = await fetchWithTimeout(
                `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json"
                  },
                  body: JSON.stringify({
                    contents: geminiMessages,
                    generationConfig: {
                      temperature: geminiParams.temperature,
                      maxOutputTokens: geminiParams.maxTokens,
                      topP: 0.95,
                      topK: 40
                    }
                  })
                },
                geminiBaseTimeout
              );
              
              if (!response.ok) {
                const errorText = await response.text();
                console.error(`Gemini 2.5 Pro API error (${response.status}): ${errorText}`);
                
                if (response.status === 504 || response.status === 524) {
                  throw new Error(`Gemini 2.5 Pro is taking longer than expected. Please try again with a simpler request.`);
                } else {
                  throw new Error(`Gemini 2.5 Pro API error: ${response.status} - ${errorText.substring(0, 100)}`);
                }
              }
              
              const geminiData = await safeJsonParse(response, "Gemini");
              aiResponse = cleanAIResponse(geminiData.candidates[0]?.content?.parts[0]?.text || "Gemini didn't provide a response. Please try again.", "Gemini");
            } catch (error) {
              console.error("Gemini 2.5 Pro specific error:", error);
              throw error;
            }
          } else {
            // Regular Gemini handling
            response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                contents: geminiMessages,
                generationConfig: {
                  temperature: geminiParams.temperature,
                  maxOutputTokens: geminiParams.maxTokens,
                  topP: 0.95,
                  topK: 40
                }
              })
            }, geminiParams.timeout);
            
            if (!response.ok) {
              const errorData = await response.text();
              console.error("Gemini API error:", response.status, errorData);
              
              if (response.status === 504 || response.status === 524) {
                throw new Error(`Gemini is taking longer than expected to generate your ${isCodeRequest ? 'code' : 'response'}. This often happens with complex requests. Try breaking your request into smaller parts or try again in a moment.`);
              } else if (response.status === 429) {
                throw new Error(`Gemini rate limit exceeded. Please wait a moment before trying again.`);
              } else if (response.status === 503) {
                throw new Error(`Gemini service is temporarily unavailable. Please try again in a few minutes.`);
              } else {
                throw new Error(`Gemini API error (${response.status}): ${errorData}`);
              }
            }
            
            const geminiData = await safeJsonParse(response, "Gemini");
            aiResponse = cleanAIResponse(geminiData.candidates[0]?.content?.parts[0]?.text || "Gemini didn't provide a response. Please try again.", "Gemini");
          }
        } catch (error) {
          console.error("Gemini error:", error);
          
          // If this was a code generation request and it failed, try with reduced complexity
          if ((isCodeRequest === true || isCodeGenerationEnabled === true) && error instanceof Error && error.message.includes('504')) {
            console.log("Retrying Gemini with simplified request...");
            
            try {
              // Simplify the request for retry
              const simplifiedMessages = geminiMessages.slice(-2).map((m: any) => ({
                role: m.role === "assistant" ? "model" : "user",
                parts: [{ text: m.content.length > 1000 ? m.content.substring(0, 1000) + "..." : m.content }]
              }));
              
              response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  contents: simplifiedMessages,
                  generationConfig: {
                    temperature: 0.3, // Lower temperature for retry
                    maxOutputTokens: 2000, // Reduced tokens
                    topP: 0.8,
                    topK: 20
                  }
                })
              }, 20000); // 20 second timeout for retry

              if (!response.ok) {
                throw error; // Throw original error if retry also fails
              }

              const retryData = await safeJsonParse(response, "Gemini");
              aiResponse = cleanAIResponse(retryData.candidates[0]?.content?.parts[0]?.text || "Gemini didn't provide a response. Please try again.", "Gemini");
              
            } catch (retryError) {
              throw error; // Throw original error
            }
          } else {
            throw error;
          }
        }
        break;

      case "deepseek":
        const deepseekParams = getOptimizedParams(25000, 1500); // Increased timeout to 25 seconds, further reduced max tokens
        const deepseekMessages = optimizeMessagesForCode(processedMessages.map((m: any) => ({ role: m.role, content: m.content })));
        
        // Use the specific model passed in (should be deepseek-v3), fallback to deepseek-chat
        const deepseekModel = model === "deepseek-v3" ? "deepseek-v3" : "deepseek-chat";
        
        try {
          response = await fetchWithTimeout("https://api.deepseek.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: deepseekModel,
              messages: deepseekMessages,
              temperature: Math.min(deepseekParams.temperature, 0.3), // Lower temperature for more consistent responses
              max_tokens: deepseekParams.maxTokens,
              stream: false
            })
          }, deepseekParams.timeout);

          if (!response.ok) {
            const errorData = await response.text();
            console.error("DeepSeek API error:", response.status, errorData);
            
            if (response.status === 504 || response.status === 524) {
              throw new Error(`DeepSeek is experiencing heavy load and timing out. Please try again in a few moments, or try a shorter request.`);
            } else if (response.status === 429) {
              throw new Error(`DeepSeek rate limit exceeded. Please wait a moment before trying again.`);
            } else if (response.status === 503) {
              throw new Error(`DeepSeek service is temporarily unavailable. Please try again in a few minutes.`);
            } else {
              throw new Error(`DeepSeek is currently unavailable (${response.status}). Please try again in a moment.`);
            }
          }

          const deepseekData = await safeJsonParse(response, "DeepSeek");
          aiResponse = cleanAIResponse(deepseekData.choices[0]?.message?.content || "DeepSeek didn't provide a response. Please try again.", "DeepSeek");
          
        } catch (deepseekError) {
          console.error("DeepSeek error:", deepseekError);
          
          // If deepseek-v3 fails, try fallback to deepseek-chat
          if (deepseekModel === "deepseek-v3") {
            console.log("Retrying with deepseek-chat model...");
            
            try {
              response = await fetchWithTimeout("https://api.deepseek.com/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                  model: "deepseek-chat",
                  messages: deepseekMessages.slice(-3), // Only use last 3 messages for fallback
                  temperature: 0.2,
                  max_tokens: 1000, // Further reduced for fallback
                  stream: false
                })
              }, 20000); // 20 second timeout for fallback

              if (!response.ok) {
                throw deepseekError; // Throw original error if fallback also fails
              }

              const fallbackData = await safeJsonParse(response, "DeepSeek");
              aiResponse = cleanAIResponse(fallbackData.choices[0]?.message?.content || "DeepSeek didn't provide a response. Please try again.", "DeepSeek");
              
            } catch (fallbackError) {
              throw deepseekError; // Throw original error
            }
          } else {
            throw deepseekError;
          }
        }
        break;

      case "grok":
        const grokParams = getOptimizedParams(15000, 2500);
        const grokMessages = optimizeMessagesForCode(processedMessages.map((m: any) => ({ role: m.role, content: m.content })));
        
        response = await fetchWithTimeout("https://api.x.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: "grok-beta",
            messages: grokMessages,
            temperature: grokParams.temperature,
            max_tokens: grokParams.maxTokens,
            stream: false
          })
        }, grokParams.timeout);

        if (!response.ok) {
          const errorData = await response.text();
          if (response.status === 504) {
            throw new Error(`Grok request timed out. Serverless time limit reached. Try a shorter request.`);
          }
          throw new Error(`Grok is currently unavailable (${response.status}). Please try again in a moment.`);
        }

        const grokData = await safeJsonParse(response, "Grok");
        aiResponse = cleanAIResponse(grokData.choices[0]?.message?.content || "Grok didn't provide a response. Please try again.", "Grok");
        break;

      case "openrouter":
        console.log("[DEBUG API] Processing OpenRouter request");
        console.log("[DEBUG API] Model:", model);
        console.log("[DEBUG API] API key exists:", !!apiKey);
        
        const openrouterParams = getOptimizedParams(15000, 2500);
        const openrouterMessages = optimizeMessagesForCode(processedMessages.map((m: any) => ({ role: m.role, content: m.content })));
        
        // For OpenRouter, use the model ID directly as it already includes the provider prefix
        // Make sure we have a properly formatted model ID (should contain a slash)
        let openrouterModelId = model;
        if (!openrouterModelId.includes('/')) {
          // If no slash, try to determine the provider and format it
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
          }
        }
        
        console.log("[DEBUG API] Using OpenRouter model ID:", openrouterModelId);
        
        try {
          response = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`,
              "HTTP-Referer": request.headers.get("referer") || "",
              "X-Title": "T3 Chat"
            },
            body: JSON.stringify({
              model: openrouterModelId,
              messages: openrouterMessages,
              temperature: openrouterParams.temperature,
              max_tokens: openrouterParams.maxTokens,
              stream: false
            })
          }, openrouterParams.timeout);

          console.log("[DEBUG API] OpenRouter response status:", response.status);
          
          if (!response.ok) {
            const errorData = await response.text();
            console.error("[ERROR API] OpenRouter error:", response.status, errorData);
            
            if (response.status === 504) {
              throw new Error(`OpenRouter request timed out. Serverless time limit reached. Try a shorter request.`);
            } else if (response.status === 401) {
              throw new Error(`OpenRouter API key is invalid or expired. Please check your API key.`);
            } else if (response.status === 404) {
              throw new Error(`The selected OpenRouter model is not available. Please choose a different model.`);
            } else if (response.status === 402) {
              throw new Error(`OpenRouter credits exhausted. Please check your account balance.`);
            }
            throw new Error(`OpenRouter is currently unavailable (${response.status}). Please try again in a moment.`);
          }

          const openrouterData = await safeJsonParse(response, "OpenRouter");
          console.log("[DEBUG API] OpenRouter response received successfully");
          aiResponse = cleanAIResponse(openrouterData.choices[0]?.message?.content || "OpenRouter didn't provide a response. Please try again.", "OpenRouter");
        } catch (error) {
          console.error("[ERROR API] OpenRouter fetch error:", error);
          throw error;
        }
        break;

      case "mistral":
        const mistralParams = getOptimizedParams(15000, 2500);
        const mistralMessages = optimizeMessagesForCode(processedMessages.map((m: any) => ({ role: m.role, content: m.content })));
        

        
        // Map model names to Mistral API model names
        let mistralModel = "mistral-large-latest";
        if (model.includes("large")) mistralModel = "mistral-large-latest";
        else if (model.includes("medium")) mistralModel = "mistral-medium-latest";
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
            max_tokens: mistralParams.maxTokens,
            stream: false
          })
        }, mistralParams.timeout);

        if (!response.ok) {
          const errorData = await response.text();
          console.error("Mistral API error:", response.status, errorData);
          if (response.status === 504) {
            throw new Error(`Mistral request timed out. Serverless time limit reached. Try a shorter request.`);
          }
          throw new Error(`Mistral API error (${response.status}): ${errorData}`);
        }

        const mistralData = await safeJsonParse(response, "Mistral");
        aiResponse = cleanAIResponse(mistralData.choices[0]?.message?.content || "Mistral didn't provide a response. Please try again.", "Mistral");
        break;

      case "veo2":
        // VEO2 video generation using dedicated endpoint
        const prompt = processedMessages[processedMessages.length - 1]?.content || "";
        
        // Construct the VEO2 endpoint URL properly
        const baseUrl = new URL(request.url).origin;
        const veo2Url = `${baseUrl}/api/veo2`;
        
        response = await fetchWithTimeout(veo2Url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            prompt: prompt,
            apiKey: apiKey,
            geminiApiKey: geminiApiKey,
            duration: 8, // Use number instead of string
            aspectRatio: "16:9"
          })
        }, 15000); // 15 second timeout for serverless compatibility

        if (!response.ok) {
          const errorData = await response.text();
          if (response.status === 504) {
            throw new Error(`VEO2 video generation timed out. Video generation requires more time than serverless functions allow. Please try a simpler prompt.`);
          }
          throw new Error(`VEO2 is currently unavailable (${response.status}). Please try again in a moment.`);
        }

        const veo2Data = await safeJsonParse(response, "VEO2");
        aiResponse = cleanAIResponse(veo2Data.data?.message || "Video generation initiated with VEO2", "VEO2");
        break;

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    // Return the AI response with model info
    clearTimeout(emergencyTimeout);
    return NextResponse.json({
      response: aiResponse,
      searchResults,
      model: model,
      provider: provider
    });

  } catch (error) {
    console.error("Chat API error:", error);
    clearTimeout(emergencyTimeout);

    // Provide helpful error message
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    
    return NextResponse.json(
      { 
        error: errorMessage,
        model: model,
        provider: provider
      },
      { status: 500 }
    );
  }
}