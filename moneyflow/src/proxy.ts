import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/session';

/**
 * Runs before every matched request: refreshes the Supabase session and turns
 * "not signed in" into a redirect before any page code executes.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and the PWA shell files, which must stay
     * reachable while signed out for the offline fallback to work.
     */
    '/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js|offline.html|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)',
  ],
};
