import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { getSafeNextPath } from './lib/auth-redirect';
import { getSupabaseConfig } from './lib/supabase/config';

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { url, key } = getSupabaseConfig();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    loginUrl.searchParams.set(
      'next',
      getSafeNextPath(`${request.nextUrl.pathname}${request.nextUrl.search}`),
    );
    const redirectResponse = NextResponse.redirect(loginUrl);

    // Supabase can clear an invalid session or rotate refresh cookies while
    // getUser() runs. Keep those Set-Cookie headers when returning the login
    // redirect, otherwise the browser keeps retrying with the stale cookie.
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });

    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/catalogo/:path*',
    '/consulta/:path*',
    '/creditos/:path*',
    '/admin/:path*',
  ],
};
