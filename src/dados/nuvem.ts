import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// A nuvem (Supabase) é opcional na etapa 0: sem as chaves o app roda só no aparelho.
const url = import.meta.env.VITE_SUPABASE_URL;
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const nuvem: SupabaseClient | null = url && chave ? createClient(url, chave) : null;

export async function entrarComGitHub(): Promise<void> {
  if (!nuvem) return;
  await nuvem.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
}

export async function sair(): Promise<void> {
  if (nuvem) await nuvem.auth.signOut();
}
