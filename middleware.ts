import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  // Let everything through - auth is handled client-side in layout components
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
