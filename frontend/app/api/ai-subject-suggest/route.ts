import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Return safe fallback suggestions so the modal works without an AI key
    return NextResponse.json({ lang2: 'Hindi', lang3: 'French', sport: 'Football', art: 'Music' }, { status: 200 });
  }

  let body: { className?: string; section?: string; mostChosen?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { className = 'Grade 8', section = 'A', mostChosen = {} } = body;

  const systemPrompt =
    'You are a school subject recommendation assistant. Given the class, section, and a pattern of what most students in that class have chosen, suggest one 2nd language (Hindi or Telugu), one 3rd language (Hindi, Telugu, or French), one sport (Football, Cricket, Basketball, or Badminton), and one art (Music, Dance, or Instruments). Reply in exactly this JSON format with no other text: {"lang2":"","lang3":"","sport":"","art":""}';

  const lang2Stat  = mostChosen.lang2  ? `Lang2: ${mostChosen.lang2}`   : 'Lang2: Hindi (18/24)';
  const lang3Stat  = mostChosen.lang3  ? `Lang3: ${mostChosen.lang3}`   : 'Lang3: French (16/24)';
  const sportStat  = mostChosen.sport  ? `Sport: ${mostChosen.sport}`   : 'Sport: Football (18/24)';
  const artStat    = mostChosen.art    ? `Art: ${mostChosen.art}`       : 'Art: Music (14/24)';

  const userPrompt = `Class: ${className}, Section: ${section}. Most students have chosen: ${lang2Stat}, ${lang3Stat}, ${sportStat}, ${artStat}. What should I recommend for a new student?`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 256,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'AI API error' }, { status: 502 });
    }

    const data = await response.json();
    const text: string = data?.content?.[0]?.text ?? '';

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return NextResponse.json({ error: 'Parse failed' }, { status: 500 });

    const parsed = JSON.parse(match[0].replace(/'/g, '"'));
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}
