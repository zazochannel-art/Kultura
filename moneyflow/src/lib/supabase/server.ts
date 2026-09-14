import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAnonKey, supabaseUrl } from './env';

/**
 * Server-side Supabase client for Server Components, Server Actions and route
 * handlers. Every query it makes runs as the signed-in user, so Row Level
 * Security — not application code — is what keeps one account out of another.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies; the middleware refresh does
          // it instead. Nothing to do here.
        }
      },
    },
  });
}
