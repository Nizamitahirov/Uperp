/** Client tərəfdən AI (Groq) çağırışı — açar serverdə qalır (12_AI_INTEGRATION.md) */

export async function generateProductDescription(
  attributes: Record<string, unknown>,
  imageUrl?: string,
): Promise<{ az: string; en: string }> {
  const res = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task: 'product_description', attributes, imageUrl }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'AI sorğusu uğursuz');
  }
  const data = await res.json();
  return data.result as { az: string; en: string };
}

export async function aiPrompt(prompt: string): Promise<string> {
  const res = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task: 'custom', prompt }),
  });
  if (!res.ok) throw new Error('AI sorğusu uğursuz');
  const data = await res.json();
  return data.result as string;
}
