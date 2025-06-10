import { NextRequest, NextResponse } from "next/server";

// Video proxy to handle authenticated Google VEO 2 video URLs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const videoUrl = searchParams.get('url');
    const apiKey = searchParams.get('key');

    console.log("=== Video Proxy Request ===");
    console.log("Video URL:", videoUrl);
    console.log("API Key:", apiKey ? `${apiKey.substring(0, 10)}...` : "not provided");

    if (!videoUrl) {
      return NextResponse.json(
        { error: "Video URL is required" },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      );
    }

    // Add API key to the video URL if not already present
    const authUrl = videoUrl.includes('key=') 
      ? videoUrl 
      : videoUrl.includes('?') 
        ? `${videoUrl}&key=${apiKey}`
        : `${videoUrl}?key=${apiKey}`;

    console.log("Fetching video from:", authUrl);

    // Fetch the video with authentication
    const response = await fetch(authUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });

    console.log("Video fetch response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Video fetch failed:", response.status, errorText);
      
      // Check if it's a Google API error
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error && errorJson.error.message) {
          const errorMessage = errorJson.error.message;
          
          // Handle specific Google API errors
          if (errorMessage.includes('Generative Language API has not been used') || 
              errorMessage.includes('SERVICE_DISABLED')) {
            return NextResponse.json(
              { 
                error: "Google API access issue",
                message: "The video cannot be downloaded due to API access restrictions. You can try right-clicking the video and selecting 'Save video as...' or contact support.",
                details: "API_ACCESS_DENIED"
              },
              { status: 403 }
            );
          }
          
          if (errorMessage.includes('PERMISSION_DENIED')) {
            return NextResponse.json(
              { 
                error: "Permission denied",
                message: "Access to this video is restricted. Try downloading directly from the browser.",
                details: "PERMISSION_DENIED"
              },
              { status: 403 }
            );
          }
        }
      } catch (parseError) {
        // Error text is not JSON, continue with generic error
      }
      
      return NextResponse.json(
        { 
          error: `Failed to fetch video: ${response.status}`,
          message: "Video download failed. You can try accessing the video directly in your browser.",
          details: errorText.substring(0, 200) // Limit error details length
        },
        { status: response.status }
      );
    }

    // Get the video content
    const videoBuffer = await response.arrayBuffer();
    console.log("Video buffer size:", videoBuffer.byteLength, "bytes");

    // Return the video with headers that prevent caching but allow streaming
    return new NextResponse(videoBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': videoBuffer.byteLength.toString(),
        // Prevent caching to ensure new videos are always fetched
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Accept-Ranges': 'bytes',
        // Add ETag based on video URL to help with conditional requests
        'ETag': `"${Buffer.from(videoUrl).toString('base64')}"`,
      },
    });

  } catch (error) {
    console.error("Video proxy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 