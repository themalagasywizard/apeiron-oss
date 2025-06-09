import { NextRequest, NextResponse } from "next/server";

// VEO 2 API Configuration
const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const VERTEX_AI_BASE_URL = "https://us-central1-aiplatform.googleapis.com/v1";

// Helper function to validate parameters
function validateParameters(prompt: string, apiKey: string, duration?: number, aspectRatio?: string) {
  if (!prompt || prompt.trim().length === 0) {
    throw new Error("Prompt is required and cannot be empty");
  }

  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error("Google API key is required for VEO 2");
  }

  if (duration && (duration < 5 || duration > 8)) {
    throw new Error("Duration must be between 5 and 8 seconds");
  }

  if (aspectRatio && !["16:9", "9:16"].includes(aspectRatio)) {
    throw new Error("Aspect ratio must be either '16:9' or '9:16'");
  }
}

// Generate video using Google VEO 2 API
async function generateVideoWithVEO2(
  prompt: string,
  apiKey: string,
  duration: number = 8,
  aspectRatio: string = "16:9",
  personGeneration: string = "dont_allow",
  negativePrompt?: string,
  seed?: number
) {
  try {
    // Use Gemini API endpoint for VEO 2
    const url = `${GEMINI_API_BASE_URL}/models/veo-2.0-generate-001:predictLongRunning?key=${apiKey}`;
    
    const requestBody = {
      instances: [{
        prompt: prompt,
        ...(negativePrompt && { negativePrompt })
      }],
      parameters: {
        aspectRatio: aspectRatio,
        personGeneration: personGeneration,
        durationSeconds: duration,
        sampleCount: 1,
        enhancePrompt: true,
        ...(seed && { seed })
      }
    };

    console.log("Sending VEO 2 request:", { url, body: requestBody });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("VEO 2 API error response:", response.status, errorData);
      
      // Parse error details if possible
      try {
        const parsedError = JSON.parse(errorData);
        throw new Error(`VEO 2 API error: ${parsedError.error?.message || parsedError.message || 'Unknown error'}`);
      } catch {
        throw new Error(`VEO 2 API error (${response.status}): ${errorData || 'Request failed'}`);
      }
    }

    const result = await response.json();
    console.log("VEO 2 API response:", result);

    return result;
  } catch (error) {
    console.error("Error calling VEO 2 API:", error);
    throw error;
  }
}

// Check operation status
async function checkOperationStatus(operationName: string, apiKey: string) {
  try {
    const url = `${GEMINI_API_BASE_URL}/${operationName}?key=${apiKey}`;
    
    console.log("Checking operation status:", url);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Operation status check error:", response.status, errorData);
      throw new Error(`Status check failed (${response.status}): ${errorData}`);
    }

    const result = await response.json();
    console.log("Operation status response:", result);

    return result;
  } catch (error) {
    console.error("Error checking operation status:", error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { 
      prompt, 
      apiKey, 
      duration = 8, 
      aspectRatio = "16:9",
      personGeneration = "dont_allow",
      negativePrompt,
      seed
    } = await request.json();

    // Validate input parameters
    validateParameters(prompt, apiKey, duration, aspectRatio);

    console.log("Starting VEO 2 video generation:", {
      prompt: prompt.substring(0, 100) + "...",
      duration,
      aspectRatio,
      personGeneration
    });

    // Check if this is a demo request (no API key or demo key)
    if (!apiKey || apiKey === "demo" || apiKey === "your-google-api-key") {
      // Return demo response for testing
      const mockOperationName = `operations/generate-video-demo-${Date.now()}`;
      
      const response = {
        success: true,
        data: {
          operationName: mockOperationName,
          status: "processing",
          prompt: prompt,
          estimatedCompletionTime: "2-6 minutes",
          videoConfig: {
            duration: `${duration}s`,
            aspectRatio: aspectRatio,
            resolution: "720p",
            format: "mp4",
            personGeneration: personGeneration
          },
          message: `🎬 **Video Generation Started (Demo Mode)**

**Prompt:** ${prompt}

**Status:** Demo processing - VEO 2 integration ready

**Configuration:**
- Duration: ${duration} seconds
- Aspect Ratio: ${aspectRatio}
- Resolution: 720p (24fps)
- Format: MP4
- Person Generation: ${personGeneration}

**Note:** This is demo mode. To generate real videos:
1. Get VEO 2 API access from Google AI Studio
2. Add your Google API key in Settings
3. VEO 2 is currently in limited preview

The production VEO 2 integration is ready and will work with a valid API key.`
        }
      };
      
      return NextResponse.json(response);
    }

    // Call the real VEO 2 API
    const operation = await generateVideoWithVEO2(
      prompt,
      apiKey,
      duration,
      aspectRatio,
      personGeneration,
      negativePrompt,
      seed
    );

    // Extract operation name from the response
    const operationName = operation.name;
    if (!operationName) {
      throw new Error("No operation name returned from VEO 2 API");
    }

    const response = {
      success: true,
      data: {
        operationName: operationName,
        status: "processing",
        prompt: prompt,
        estimatedCompletionTime: "2-6 minutes",
        videoConfig: {
          duration: `${duration}s`,
          aspectRatio: aspectRatio,
          resolution: "720p",
          format: "mp4",
          personGeneration: personGeneration
        },
        message: `🎬 **Video Generation Started**

**Prompt:** ${prompt}

**Status:** Processing with Google VEO 2

**Configuration:**
- Duration: ${duration} seconds
- Aspect Ratio: ${aspectRatio}
- Resolution: 720p (24fps)
- Format: MP4
- Person Generation: ${personGeneration}

**Estimated Time:** 2-6 minutes

Your video is being generated using Google's VEO 2 model. This is a real production request that will create high-quality, cinematic video from your text description.

The video will appear above once processing is complete.`
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error("VEO 2 generation error:", error);
    
    // Provide helpful error messages for common issues
    let errorMessage = "Failed to generate video";
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Handle specific API errors
      if (errorMessage.includes("API key")) {
        errorMessage = "Invalid or missing Google API key. Please check your VEO 2 API key in Settings.";
      } else if (errorMessage.includes("quota")) {
        errorMessage = "VEO 2 API quota exceeded. Please try again later or check your billing.";
      } else if (errorMessage.includes("permission") || errorMessage.includes("403")) {
        errorMessage = "VEO 2 API access denied. VEO 2 is currently in limited preview. Please apply for access at Google AI Studio.";
      } else if (errorMessage.includes("404")) {
        errorMessage = "VEO 2 model not found. The service may not be available in your region or your API key may not have VEO 2 access.";
      } else if (errorMessage.includes("500") || errorMessage.includes("502") || errorMessage.includes("503")) {
        errorMessage = "VEO 2 service is temporarily unavailable. Please try again in a few minutes.";
      }
    }

    return NextResponse.json(
      { 
        error: errorMessage,
        details: error instanceof Error ? error.message : "Unknown error occurred"
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check video generation status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const operationName = searchParams.get('operationName');
    const apiKey = searchParams.get('apiKey');

    if (!operationName) {
      return NextResponse.json(
        { error: "Operation name is required" },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      );
    }

    console.log("Checking VEO 2 operation status:", operationName);

    // Handle demo operations
    if (operationName.includes('demo') || !apiKey || apiKey === "demo" || apiKey === "your-google-api-key") {
      // Simulate processing for demo
      const progress = Math.min(95, 20 + Math.floor(Math.random() * 60));
      
      const response = {
        success: true,
        data: {
          operationName: operationName,
          status: "processing",
          progress: progress,
          videoUrl: null,
          error: null,
          duration: "5-8s",
          createdAt: new Date().toISOString(),
          message: `Demo operation in progress (${progress}%). Real VEO 2 integration ready for production use.`
        }
      };

      return NextResponse.json(response);
    }

    // Check the real operation status
    const statusResult = await checkOperationStatus(operationName, apiKey);

    let status = "processing";
    let progress = 50;
    let videoUrl = null;
    let error = null;

    if (statusResult.done === true) {
      if (statusResult.response) {
        status = "completed";
        progress = 100;
        
        // Extract video URL from the response
        const generatedVideos = statusResult.response.generatedVideos || 
                              statusResult.response.videos ||
                              statusResult.response.generatedSamples;
        
        if (generatedVideos && generatedVideos.length > 0) {
          const firstVideo = generatedVideos[0];
          videoUrl = firstVideo.video?.uri || firstVideo.uri || firstVideo.gcsUri;
          
          // If it's a GCS URI, we need to append the API key for access
          if (videoUrl && videoUrl.includes('gs://')) {
            // For GCS URIs, we might need to use a different access method
            // This depends on how Google provides access to the generated videos
            console.log("Generated video GCS URI:", videoUrl);
          }
        }
      } else if (statusResult.error) {
        status = "failed";
        progress = 0;
        error = statusResult.error.message || "Video generation failed";
      }
    } else {
      // Still processing
      status = "processing";
      progress = Math.min(90, 20 + Math.floor(Math.random() * 50)); // Simulate progress
    }

    const response = {
      success: true,
      data: {
        operationName: operationName,
        status: status,
        progress: progress,
        videoUrl: videoUrl,
        error: error,
        duration: "5-8s",
        createdAt: new Date().toISOString(),
        ...(status === "completed" && { completedAt: new Date().toISOString() })
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error("VEO 2 status check error:", error);
    return NextResponse.json(
      { 
        error: "Failed to check video status",
        details: error instanceof Error ? error.message : "Unknown error occurred"
      },
      { status: 500 }
    );
  }
} 