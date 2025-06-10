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
      return NextResponse.json(
        { error: `Failed to fetch video: ${response.status}` },
        { status: response.status }
      );
    }

    // Get the video content
    const videoBuffer = await response.arrayBuffer();
    console.log("Video buffer size:", videoBuffer.byteLength, "bytes");

    // Return the video with proper headers
    return new NextResponse(videoBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': videoBuffer.byteLength.toString(),
        'Cache-Control': 'public, max-age=3600',
        'Accept-Ranges': 'bytes',
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