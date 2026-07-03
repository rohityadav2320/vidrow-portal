import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  try {
    const { email, full_name } = await req.json();

    if (!email || !full_name) {
      return NextResponse.json({ error: 'Email and name are required' }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002';

    // Create the auth user and send invite email
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${appUrl}/dashboard`,
      data: { full_name },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const userId = data.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }

    // Create the user profile so they can access the portal
    const { error: profileError } = await supabaseAdmin.from('users').upsert({
      id: userId,
      email,
      full_name,
      role: 'admin',
      status: 'active',
    });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      return NextResponse.json({ error: 'User invited but profile creation failed: ' + profileError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, userId });
  } catch (err: any) {
    console.error('Invite error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
