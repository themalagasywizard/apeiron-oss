import { NextRequest, NextResponse } from "next/server";

// Image Generation API Route
// Supports RunwayML and OpenAI DALL-E
export async function POST(request: NextRequest) {
  try {
    const { prompt, model } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY || request.headers.get('openai-api-key');
    const runwayApiKey = process.env.RUNWAY_API_KEY || request.headers.get('runway-api-key');

    let provider = 'openai'; // Default provider
    let imageUrl: string | null = null;

    // Check if specific model is requested
    if (model?.includes('gen3') || model?.includes('gen2') || model?.includes('runway')) {
      if (!runwayApiKey) {
        return NextResponse.json({ error: 'RunwayML API key required for RunwayML models' }, { status: 400 });
      }
      provider = 'runway';
    } else if (model?.includes('dall-e') || model?.includes('gpt')) {
      if (!openaiApiKey) {
        return NextResponse.json({ error: 'OpenAI API key required for DALL-E models' }, { status: 400 });
      }
      provider = 'openai';
    } else {
      // Auto-select based on available API keys (prioritize dedicated image generation APIs)
      if (runwayApiKey) {
        provider = 'runway';
      } else if (openaiApiKey) {
        provider = 'openai';
      } else {
        return NextResponse.json({ error: 'No image generation API keys configured' }, { status: 400 });
      }
    }

    // Generate image based on provider
    try {
      switch (provider) {
        case 'runway':
          imageUrl = await generateWithRunway(prompt, runwayApiKey!);
          break;
        case 'openai':
        default:
          imageUrl = await generateWithOpenAI(prompt, openaiApiKey!);
          break;
      }

      if (imageUrl) {
        return NextResponse.json({ imageUrl, provider });
      } else {
        return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
      }
    } catch (error) {
      console.error(`${provider} generation error:`, error);
      return NextResponse.json({ 
        error: `Image generation failed with ${provider}. Please try again or use a different provider.`
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Image generation API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper function for OpenAI DALL-E
async function generateWithOpenAI(prompt: string, apiKey: string): Promise<string | null> {
  try {
    console.log('Attempting OpenAI DALL-E generation with prompt:', prompt);
    
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard'
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.data?.[0]?.url || null;
  } catch (error) {
    console.error('OpenAI DALL-E generation error:', error);
    return null;
  }
}

// Helper function for RunwayML
async function generateWithRunway(prompt: string, apiKey: string): Promise<string | null> {
  try {
    console.log('Attempting RunwayML generation with prompt:', prompt);
    
    const response = await fetch('https://api.runwayml.com/v1/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        prompt: prompt,
        model: 'gen3',
        width: 1024,
        height: 1024
      })
    });

    if (!response.ok) {
      throw new Error(`RunwayML API error: ${response.status}`);
    }

    const data = await response.json();
    return data.url || null;
  } catch (error) {
    console.error('RunwayML generation error:', error);
    return null;
  }
}

