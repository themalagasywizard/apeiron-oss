# Netlify Edge Functions for T3 Chat

## Overview

This directory contains Netlify Edge Functions that provide enhanced capabilities for AI code generation with higher execution time limits and better performance.

## Edge Functions

### `generate-code.js`

**Purpose**: Handles AI code generation requests with enhanced parameters and longer execution times.

**Route**: `/api/generate-code`

**Features**:
- **Higher Token Limits**: Up to 8,000 tokens (vs 2,500 for regular chat)
- **Extended Timeouts**: 60-second timeout (vs 15 seconds for regular chat)
- **Optimized for Code**: Lower temperature (0.1) for focused output
- **Advanced Instructions**: Enhanced prompts for production-ready code
- **Edge Performance**: Runs at network edge for faster response times

**Automatic Routing**:
The main chat API automatically detects code generation requests based on keywords and routes them to this Edge Function:

- `html`, `css`, `javascript`, `js`
- `code`, `function`, `component`
- `website`, `app`, `build`
- `create`, `develop`, `program`
- `react`, `vue`, `angular`, `node`
- `python`, `java`, `php`, `sql`
- `<` (HTML tags), `` ``` `` (code blocks)

## Benefits of Edge Functions

1. **Higher Execution Time Limits**: Not subject to the 30-second limit of regular serverless functions
2. **Better Performance**: Runs at the network edge closer to users
3. **Deno Runtime**: Optimized JavaScript/TypeScript runtime
4. **Resource Efficiency**: Better suited for compute-intensive tasks like AI generation

## Configuration

The Edge Function routing is configured in `netlify.toml`:

```toml
[[edge_functions]]
  function = "generate-code"
  path = "/api/generate-code"
```

## Usage

Code generation requests are automatically routed to the Edge Function when the main chat API detects code-related keywords. No manual routing is required - the system handles this transparently.

## Error Handling

If the Edge Function fails, the system gracefully falls back to the regular serverless function with shorter timeout limits.

## Supported AI Providers

- OpenAI (GPT-4o, GPT-3.5-turbo)
- Claude 3 Opus
- Gemini 2.5 Flash Preview
- DeepSeek Chat
- Grok Beta
- OpenRouter (various models)

## Response Format

Edge Function responses include additional metadata:

```json
{
  "response": "Generated code...",
  "model": "gpt-4o",
  "provider": "openai",
  "codeGeneration": true,
  "timestamp": "2025-06-10T17:15:00.000Z"
}
``` 