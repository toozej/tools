import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { text } = await request.json();

  if (!text) {
    return NextResponse.json({ error: 'Text is required' }, { status: 400 });
  }

  const endpoint = process.env.TTS_ENDPOINT;
  const token = process.env.TTS_TOKEN;
  const model = process.env.TTS_MODEL;

  if (!endpoint || !token) {
    return NextResponse.json({ error: 'TTS configuration missing' }, { status: 500 });
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, model }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: `TTS API failed: ${response.status} ${response.statusText}` }, { status: 500 });
    }

    const audioBuffer = await response.arrayBuffer();

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: `Error generating TTS: ${error instanceof Error ? error.message : 'Unknown error'}` }, { status: 500 });
  }
}