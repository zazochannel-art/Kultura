/**
 * Supabase connection details.
 *
 * Read lazily rather than at module load: `next build` runs this file while
 * prerendering, and a missing variable there should not fail the build — it
 * should fail the request that actually needs a database, with a message that
 * says which variable is missing.
 */

export function supabaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set. Copy .env.example to .env.local.');
  return value;
}

export function supabaseAnonKey(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!value) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. Copy .env.example to .env.local.');
  }
  return value;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  );
}
