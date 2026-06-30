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

/** Qrafik datasını AI ilə iki dildə (AZ/EN) izah edir */
export async function explainChart(input: {
  title: string;
  type: string;
  data: unknown;
  context?: string;
}): Promise<{ az: string; en: string }> {
  const res = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task: 'chart_explain',
      chartTitle: input.title,
      chartType: input.type,
      chartData: input.data,
      context: input.context,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'AI izahı uğursuz');
  }
  const data = await res.json();
  return data.result as { az: string; en: string };
}

/** Səhifə bələdçisi — AI ilə səhifənin məqsədi, istifadəsi, iş axını və datası (AZ/EN) */
export async function explainPage(pageInfo: Record<string, unknown>): Promise<{ az: string; en: string }> {
  const res = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task: 'page_guide', pageInfo }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'AI izahı uğursuz');
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
