import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

interface GenerateBody {
  task: 'product_description' | 'summary' | 'custom';
  prompt?: string;
  attributes?: Record<string, unknown>;
}

function buildMessages(body: GenerateBody) {
  if (body.task === 'product_description') {
    const a = body.attributes ?? {};
    return [
      {
        role: 'system',
        content:
          'Sən moda jurnalı tonunda yazan peşəkar marketinq kopiraytersən. Cins (denim) məhsulları üçün cəlbedici təsvir yazırsan. Cavabı dəqiq bu JSON formatında ver: {"az": "...", "en": "..."}. Başqa heç nə yazma.',
      },
      {
        role: 'user',
        content: `Bu cins şalvar üçün qısa (2-3 cümlə) cəlbedici təsvir yaz. Atributlar: ${JSON.stringify(a)}. Azərbaycan və İngilis dillərində.`,
      },
    ];
  }
  return [
    { role: 'system', content: 'Sən faydalı köməkçisən. Azərbaycan dilində cavab ver.' },
    { role: 'user', content: body.prompt ?? '' },
  ];
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GROQ_API_KEY konfiqurasiya edilməyib' }, { status: 503 });
  }

  let body: GenerateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Yanlış sorğu' }, { status: 400 });
  }

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: buildMessages(body),
        temperature: 0.7,
        max_tokens: 600,
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ error: `Groq xətası: ${res.status}`, detail: txt }, { status: 502 });
    }

    const data = await res.json();
    const content: string = data.choices?.[0]?.message?.content ?? '';

    if (body.task === 'product_description') {
      // JSON çıxarmağa cəhd et
      try {
        const match = content.match(/\{[\s\S]*\}/);
        const parsed = match ? JSON.parse(match[0]) : { az: content, en: '' };
        return NextResponse.json({ result: parsed });
      } catch {
        return NextResponse.json({ result: { az: content, en: '' } });
      }
    }

    return NextResponse.json({ result: content });
  } catch (err) {
    return NextResponse.json({ error: 'AI sorğusu uğursuz', detail: String(err) }, { status: 500 });
  }
}
