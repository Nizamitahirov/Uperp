import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const TEXT_MODEL = 'llama-3.3-70b-versatile';
// Multimodal (şəkil) model — Groq Llama 4 Scout
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

interface GenerateBody {
  task: 'product_description' | 'summary' | 'custom' | 'chart_explain' | 'page_guide';
  prompt?: string;
  attributes?: Record<string, unknown>;
  imageUrl?: string;
  // chart_explain üçün
  chartTitle?: string;
  chartType?: string;
  chartData?: unknown;
  context?: string;
  // page_guide üçün
  pageInfo?: Record<string, unknown>;
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

  const isProductDesc = body.task === 'product_description';
  const isChartExplain = body.task === 'chart_explain';
  const isPageGuide = body.task === 'page_guide';
  const useVision = isProductDesc && !!body.imageUrl;
  const wantsJson = isProductDesc || isChartExplain || isPageGuide;

  let messages: unknown[];
  if (isPageGuide) {
    const sys =
      'Sən UP ERP (cins/denim istehsalı) sisteminin daxili təlimçisisən. İstifadəçiyə bir səhifəni izah edirsən. Cavabı HEKAYƏ formatında, aydın strukturla yaz. Markdown istifadə et: "### Bu səhifə nədir?" (1-2 cümlə məqsəd), "### Necə istifadə olunur?" (nömrəli addımlar), "### İş axınında yeri" (Əvvəlki addım → bu səhifə → Sonrakı addım), "### Datanın mənası" (verilən rəqəmlərin nəyə təsir etdiyi). Sadə, praktiki dil. Cavabı DƏQİQ bu JSON formatında ver: {"az": "...markdown...", "en": "...markdown..."}. Başqa heç nə yazma.';
    messages = [
      { role: 'system', content: sys },
      { role: 'user', content: `Səhifə məlumatı (JSON): ${JSON.stringify(body.pageInfo ?? {}).slice(0, 3000)}. Bu səhifəni istifadəçiyə hekayə formatında izah et.` },
    ];
  } else if (isChartExplain) {
    const sys =
      'Sən təcrübəli biznes data analitikisən (cins/denim istehsalı ERP-i). Sənə qrafikin başlığı və datası verilir. Sən qısa, dəqiq, rəqəmlərə əsaslanan izah yazırsan: əsas tendensiya, ən yüksək/aşağı nöqtə, anomaliya və 1 praktiki tövsiyə. 2-4 cümlə. Cavabı DƏQİQ bu JSON formatında ver: {"az": "...", "en": "..."}. az = Azərbaycan dili, en = English. Başqa heç nə yazma.';
    messages = [
      { role: 'system', content: sys },
      {
        role: 'user',
        content: `Qrafik başlığı: "${body.chartTitle ?? ''}" (tip: ${body.chartType ?? 'chart'}).${body.context ? ` Kontekst: ${body.context}.` : ''} Data (JSON): ${JSON.stringify(body.chartData ?? []).slice(0, 3000)}. Bu datanı təhlil et və izah ver.`,
      },
    ];
  } else if (isProductDesc) {
    const a = body.attributes ?? {};
    const sys =
      'Sən moda jurnalı tonunda yazan peşəkar marketinq kopiraytersən. Cins (denim) məhsulları üçün cəlbedici, qısa təsvir yazırsan. Cavabı dəqiq bu JSON formatında ver: {"az": "...", "en": "..."}. Başqa heç nə yazma.';
    if (useVision) {
      messages = [
        { role: 'system', content: sys },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Bu şəkildəki cins məhsula baxaraq cəlbedici təsvir yaz (2-3 cümlə, AZ və EN). Əlavə atributlar: ${JSON.stringify(a)}.` },
            { type: 'image_url', image_url: { url: body.imageUrl } },
          ],
        },
      ];
    } else {
      messages = [
        { role: 'system', content: sys },
        { role: 'user', content: `Bu cins şalvar üçün qısa cəlbedici təsvir yaz. Atributlar: ${JSON.stringify(a)}. AZ və EN.` },
      ];
    }
  } else {
    messages = [
      { role: 'system', content: 'Sən faydalı köməkçisən. Azərbaycan dilində cavab ver.' },
      { role: 'user', content: body.prompt ?? '' },
    ];
  }

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: useVision ? VISION_MODEL : TEXT_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 700,
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ error: `Groq xətası: ${res.status}`, detail: txt }, { status: 502 });
    }

    const data = await res.json();
    const content: string = data.choices?.[0]?.message?.content ?? '';

    if (wantsJson) {
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
