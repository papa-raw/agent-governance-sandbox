import Anthropic from '@anthropic-ai/sdk';

let clientInstance: Anthropic | null = null;

/**
 * Get or create the Anthropic client.
 * Uses VITE_ANTHROPIC_API_KEY from environment.
 * For hackathon demo — production would use a server proxy.
 */
export function getClient(): Anthropic | null {
  const apiKey = (import.meta.env.VITE_OPENROUTER_API_KEY ?? import.meta.env.VITE_ANTHROPIC_API_KEY) as string | undefined;
  if (!apiKey) return null;

  if (!clientInstance) {
    const isOpenRouter = apiKey.startsWith('sk-or-');
    clientInstance = new Anthropic({
      apiKey,
      baseURL: isOpenRouter ? 'https://openrouter.ai/api/v1' : undefined,
      dangerouslyAllowBrowser: true,
    });
  }

  return clientInstance;
}

/**
 * Check if the LLM runtime is available (API key configured).
 */
export function isLLMAvailable(): boolean {
  return !!(import.meta.env.VITE_OPENROUTER_API_KEY ?? import.meta.env.VITE_ANTHROPIC_API_KEY);
}

/**
 * Check if we're routing through OpenRouter (model IDs need provider/ prefix).
 */
export function isOpenRouter(): boolean {
  const apiKey = (import.meta.env.VITE_OPENROUTER_API_KEY ?? import.meta.env.VITE_ANTHROPIC_API_KEY) as string | undefined;
  return !!apiKey?.startsWith('sk-or-');
}
