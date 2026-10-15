import { AnthropicAiProvider } from "@/server/ai/anthropic";
import { MockAiProvider } from "@/server/ai/mock";
import type { AiProvider } from "@/server/ai/provider";

/**
 * Picks the provider for this request.
 *
 * The rule is deliberately simple and fails safe: a real provider is used
 * only when a key is configured *and* the mock has not been forced. Anything
 * else falls back to the deterministic mock, so the app is never broken by a
 * missing or revoked key.
 */
export function selectAiProvider(
  // Typed structurally rather than as `NodeJS.ProcessEnv` so a test can pass
  // just the variables under test.
  env: Record<string, string | undefined> = process.env,
): AiProvider {
  if (env.AI_PROVIDER === "mock") return new MockAiProvider();

  const key = env.ANTHROPIC_API_KEY?.trim();
  if (key && key.length > 0) return new AnthropicAiProvider(key);

  return new MockAiProvider();
}

export type { AiProvider, AiResult, AiContext } from "@/server/ai/provider";
