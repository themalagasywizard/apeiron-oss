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
    
    console.log("Checking operation status for:", operationName);
    console.log("Status check URL:", url);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log("Status check response status:", response.status);

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Operation status check error:", response.status, errorData);
      throw new Error(`Status check failed (${response.status}): ${errorData}`);
    }

    const result = await response.json();
    console.log("Operation status response:", JSON.stringify(result, null, 2));

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

    console.log("=== VEO 2 Status Check Request ===");
    console.log("Operation Name:", operationName);
    console.log("API Key:", apiKey ? `${apiKey.substring(0, 10)}...` : "not provided");
    console.log("Timestamp:", new Date().toISOString());

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

    // Handle demo operations
    if (operationName.includes('demo') || !apiKey || apiKey === "demo" || apiKey === "your-google-api-key") {
      console.log("Processing demo operation status check");
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

      console.log("Demo status response:", JSON.stringify(response, null, 2));
      return NextResponse.json(response);
    }

    console.log("Checking real VEO 2 operation status...");
    
    // Check the real operation status
    const statusResult = await checkOperationStatus(operationName, apiKey);

    let status = "processing";
    let progress = 50;
    let videoUrl = null;
    let error = null;
    let debugInfo = {};

    console.log("Raw status result from Google:", JSON.stringify(statusResult, null, 2));

    if (statusResult.done === true) {
      console.log("Operation is complete!");
      if (statusResult.response) {
        status = "completed";
        progress = 100;
        
        console.log("Full response object:", JSON.stringify(statusResult.response, null, 2));
        
        // Try multiple approaches to extract video URL
        let generatedVideos = null;
        
        // First, try the standard locations
        generatedVideos = statusResult.response.generatedVideos || 
                         statusResult.response.videos ||
                         statusResult.response.generatedSamples;
        
        // If not found, try looking inside generateVideoResponse
        if (!generatedVideos && statusResult.response.generateVideoResponse) {
          console.log("Looking inside generateVideoResponse:", JSON.stringify(statusResult.response.generateVideoResponse, null, 2));
          generatedVideos = statusResult.response.generateVideoResponse.generatedVideos ||
                           statusResult.response.generateVideoResponse.videos ||
                           statusResult.response.generateVideoResponse.generatedSamples;
        }
        
        // Also try the top-level response if it has video data directly
        if (!generatedVideos && (statusResult.response.uri || statusResult.response.gcsUri || statusResult.response.video)) {
          console.log("Found direct video data in response");
          generatedVideos = [statusResult.response];
        }
        
        console.log("Final generatedVideos:", JSON.stringify(generatedVideos, null, 2));
        
        if (generatedVideos && generatedVideos.length > 0) {
          const firstVideo = generatedVideos[0];
          console.log("First video object:", JSON.stringify(firstVideo, null, 2));
          
          // Try multiple fields for video URL
          videoUrl = firstVideo.video?.uri || 
                    firstVideo.uri || 
                    firstVideo.gcsUri ||
                    firstVideo.video?.gcsUri ||
                    firstVideo.downloadUri ||
                    firstVideo.video?.downloadUri;
          
          console.log("Extracted video URL:", videoUrl);
          
          // If it's a GCS URI, we need to convert it to a proper download URL
          if (videoUrl && videoUrl.includes('gs://')) {
            console.log("Converting GCS URI to downloadable URL");
            // For GCS URIs from VEO 2, we need to use the proper download format
            // The format is usually: https://storage.googleapis.com/bucket/path
            videoUrl = videoUrl.replace('gs://', 'https://storage.googleapis.com/');
            console.log("Converted video URL:", videoUrl);
          }
          
          // If still no URL, check for base64 encoded data
          if (!videoUrl && (firstVideo.data || firstVideo.video?.data)) {
            console.log("Found base64 video data, creating blob URL");
            const videoData = firstVideo.data || firstVideo.video?.data;
            // Note: In a real implementation, you'd need to handle base64 data differently
            // For now, we'll log it and set an error
            console.log("Video data length:", videoData ? videoData.length : 0);
            error = "Video generated as base64 data - download feature needed";
          }
          
        } else {
          console.log("No video data found in any expected location");
          console.log("Available response keys:", Object.keys(statusResult.response));
          
          // Try to find any field that might contain video data
          const responseStr = JSON.stringify(statusResult.response);
          if (responseStr.includes('gs://') || responseStr.includes('http')) {
            console.log("Found potential URLs in response, manual extraction needed");
            // Try to extract any URL-like strings
            const urlMatches = responseStr.match(/(gs:\/\/[^\s"]+|https?:\/\/[^\s"]+)/g);
            if (urlMatches && urlMatches.length > 0) {
              console.log("Found URLs:", urlMatches);
              videoUrl = urlMatches[0];
              if (videoUrl.includes('gs://')) {
                videoUrl = videoUrl.replace('gs://', 'https://storage.googleapis.com/');
              }
            }
          }
          
          if (!videoUrl) {
            error = "Video generation completed but no video URL was returned";
          }
        }
        
        debugInfo = {
          hasResponse: true,
          responseKeys: statusResult.response ? Object.keys(statusResult.response) : [],
          generatedVideosCount: generatedVideos ? generatedVideos.length : 0,
          hasGenerateVideoResponse: !!statusResult.response.generateVideoResponse,
          generateVideoResponseKeys: statusResult.response.generateVideoResponse ? Object.keys(statusResult.response.generateVideoResponse) : [],
          extractedVideoUrl: videoUrl,
          rawResponseSize: JSON.stringify(statusResult.response).length
        };
      } else if (statusResult.error) {
        console.log("Operation failed with error:", statusResult.error);
        status = "failed";
        progress = 0;
        error = statusResult.error.message || "Video generation failed";
        debugInfo = { hasError: true, errorMessage: statusResult.error.message };
      } else {
        console.log("Operation done but no response or error");
        status = "failed";
        progress = 0;
        error = "Video generation completed with unknown status";
        debugInfo = { unexpectedState: true, statusResult };
      }
    } else {
      // Still processing
      console.log("Operation still processing...");
      status = "processing";
      // Calculate progress based on how long it's been running (estimate)
      const estimatedProgress = Math.min(90, 20 + Math.floor(Math.random() * 50));
      progress = estimatedProgress;
      debugInfo = { stillProcessing: true, done: statusResult.done };
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
        ...(status === "completed" && { completedAt: new Date().toISOString() }),
        debugInfo: debugInfo
      }
    };

    console.log("Final status response:", JSON.stringify(response, null, 2));
    console.log("=== End Status Check ===");

    return NextResponse.json(response);

  } catch (error) {
    console.error("VEO 2 status check error:", error);
    const errorResponse = { 
      error: "Failed to check video status",
      details: error instanceof Error ? error.message : "Unknown error occurred",
      timestamp: new Date().toISOString()
    };
    console.log("Error response:", JSON.stringify(errorResponse, null, 2));
    return NextResponse.json(errorResponse, { status: 500 });
  }
} 