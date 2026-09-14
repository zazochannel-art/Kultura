import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Every server action starts here.
 *
 * Row Level Security already stops one user reading another's rows, so this is
 * not the security boundary — it is the thing that turns "no session" into a
 * clean error instead of a confusing empty result, and it hands back the user
 * id that writes need for their `user_id` column.
 */
export async function requireUser(): Promise<{ supabase: SupabaseClient; userId: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  return { supabase, userId: user.id };
}
