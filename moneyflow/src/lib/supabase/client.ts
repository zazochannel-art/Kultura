'use client';

import { createBrowserClient } from '@supabase/ssr';
import { supabaseAnonKey, supabaseUrl } from './env';

/** Browser-side Supabase client. Carries the user's session cookie; RLS does the rest. */
export function createClient() {
  return createBrowserClient(supabaseUrl(), supabaseAnonKey());
}
