import Anthropic from '@anthropic-ai/sdk';

let clientInstance: Anthropic | null = null;

/**
 * Get or create the Anthropic client.
 * Uses VITE_ANTHROPIC_API_KEY from environment.
 * For hackathon demo — production would use a server proxy.
 */
export function getClient(): Anthropic | null {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;
  if (!apiKey) return null;

  if (!clientInstance) {
    clientInstance = new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true,
    });
  }

  return clientInstance;
}

/**
 * Check if the LLM runtime is available (API key configured).
 */
export function isLLMAvailable(): boolean {
  return !!import.meta.env.VITE_ANTHROPIC_API_KEY;
}
