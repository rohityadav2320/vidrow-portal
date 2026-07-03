import { supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const creatorId = searchParams.get('creator_id');
    const status = searchParams.get('status');

    let query = supabase.from('assignments').select('*');

    if (creatorId) {
      query = query.eq('creator_id', creatorId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data, success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error', success: false },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { data, error } = await supabase
      .from('assignments')
      .insert(body)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data, success: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error', success: false },
      { status: 400 }
    );
  }
}
