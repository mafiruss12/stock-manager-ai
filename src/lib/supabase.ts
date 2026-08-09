import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Toujours ces valeurs en production (évite build Vercel sans env) */
const SUPABASE_URL = 'https://ycoaxbgxstxondxxnhhf.supabase.co';
const SUPABASE_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inljb2F4Ymd4c3R4b25keHhuaGhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2MTg5MTgsImV4cCI6MjEwMTE5NDkxOH0.iSPqcC8X1BXlgVYfhtFBY4QFq9UwiMycSisfhkNxV80';

const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

const supabaseUrl =
  envUrl && envUrl.startsWith('http') && !envUrl.includes('placeholder') ? envUrl : SUPABASE_URL;
const supabaseAnonKey =
  envKey && envKey.length > 40 && !envKey.includes('placeholder') ? envKey : SUPABASE_ANON;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    // storageKey: défaut Supabase (évite de couper les sessions existantes)
    // implicit = plus fiable que PKCE sur mobile / redirections
    flowType: 'implicit',
  },
});
