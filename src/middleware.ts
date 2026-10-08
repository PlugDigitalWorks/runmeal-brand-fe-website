import { NextRequest, NextResponse } from 'next/server';
import { COUNTRY_COOKIE_NAME } from '@/i18n/country';

// Cloudflare puts the visitor's country in `CF-IPCountry`. The UI language is
// picked on the client (src/i18n/config.ts), so hand the country over in a
// cookie: TR visitors get Turkish, everyone else English.
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const country = request.headers.get('cf-ipcountry')?.toUpperCase();

  if (country && request.cookies.get(COUNTRY_COOKIE_NAME)?.value !== country) {
    response.cookies.set(COUNTRY_COOKIE_NAME, country, {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return response;
}

export const config = {
  // Pages only: skip API routes, Next.js internals and static files.
  matcher: '/((?!api|_next|.*\\..*).*)',
};
