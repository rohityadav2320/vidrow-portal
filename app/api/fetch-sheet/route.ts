import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sheetId = searchParams.get('sheetId');
  const gid     = searchParams.get('gid');

  if (!sheetId) return NextResponse.json({ error: 'Missing sheetId' }, { status: 400 });

  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gid ? `&gid=${gid}` : ''}`;

  let res: Response;
  try {
    res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  } catch {
    return NextResponse.json({ error: 'Network error fetching sheet.' }, { status: 502 });
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: 'Could not fetch sheet. Make sure it is shared as "Anyone with the link can view".' },
      { status: 400 }
    );
  }

  const csv = await res.text();
  return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8' } });
}
