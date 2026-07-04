import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Delete all related rows first
    await supabaseAdmin.from('editor_assignments').delete().eq('script_id', id);
    await supabaseAdmin.from('assignments').delete().eq('script_id', id);

    const { error } = await supabaseAdmin.from('scripts').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
