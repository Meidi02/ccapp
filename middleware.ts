import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './lib/auth';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;

  // Allow next internal and static files
  if (request.nextUrl.pathname.startsWith('/_next') || 
      request.nextUrl.pathname.includes('.') ||
      request.nextUrl.pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  // Unprotected Routes
  if (request.nextUrl.pathname.startsWith('/login')) {
    if (token) {
      const verified = await verifyToken(token);
      if (verified) {
        return NextResponse.redirect(new URL('/', request.url));
      }
    }
    return NextResponse.next();
  }

  // Unprotected API routes
  if (request.nextUrl.pathname.startsWith('/api/call') || 
      request.nextUrl.pathname.startsWith('/api/sms') ||
      request.nextUrl.pathname.startsWith('/api/auth')) {
     return NextResponse.next();
  }

  // Check Authentication
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const verified = await verifyToken(token);
  if (!verified) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Admin routes protection
  if (request.nextUrl.pathname.startsWith('/admin') && verified.role !== 'MASTER') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Add user context to headers for API routes
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', verified.userId);
  requestHeaders.set('x-user-role', verified.role);
  requestHeaders.set('x-username', verified.username);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
