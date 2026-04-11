import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const APP_ROUTES = [
  '/dashboard', '/coa', '/journal', '/ar', '/ap',
  '/cash', '/expenses', '/reports', '/settings', '/tax', '/pos', '/inventory',
];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  const isAppRoute = APP_ROUTES.some(r => pathname.startsWith(r));
  const isAuthRoute = pathname === '/login' || pathname === '/register';
  const isAdminRoute = pathname.startsWith('/admin');

  // Not logged in → redirect to login
  if ((isAppRoute || isAdminRoute) && !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Logged-in on app routes → verify they have a company (invite was valid at signup)
  if (isAppRoute && user) {
    const { data: uc } = await supabase
      .from('user_companies')
      .select('company_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (!uc) {
      return NextResponse.redirect(new URL('/pending', request.url));
    }
  }

  // Admin route → only admin email allowed
  if (isAdminRoute && user) {
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    if (adminEmail && user.email !== adminEmail) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // Already logged in → skip auth pages
  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
