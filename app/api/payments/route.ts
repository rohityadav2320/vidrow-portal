import { supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const userId = searchParams.get('user_id');

    let query = supabase.from('payments').select('*');

    if (status) {
      query = query.eq('status', status);
    }

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query.order('due_date', { ascending: true });

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
      .from('payments')
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
