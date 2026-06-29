import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/** Workflow webhook proxy — client CORS məhdudiyyətini keçmək üçün server tərəfdən çağırır */
export async function POST(req: NextRequest) {
  let body: { url?: string; payload?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Yanlış sorğu' }, { status: 400 });
  }
  if (!body.url || !/^https?:\/\//.test(body.url)) {
    return NextResponse.json({ error: 'Yanlış URL' }, { status: 400 });
  }
  try {
    const res = await fetch(body.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body.payload ?? {}),
      signal: AbortSignal.timeout(8000),
    });
    return NextResponse.json({ ok: res.ok, status: res.status });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
  }
}
