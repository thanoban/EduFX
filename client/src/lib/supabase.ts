import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase =
  url && anon
    ? createClient(url, anon, {
        auth: {
          // PKCE is the secure flow for browser OAuth + email sign-in.
          flowType: "pkce",
          // Let supabase-js exchange the ?code= on the callback page itself,
          // then surface the session through onAuthStateChange. The callback
          // screen waits for that session instead of exchanging the code a
          // second time (a double-exchange races and consumes the one-time code).
          detectSessionInUrl: true,
          persistSession: true,
          autoRefreshToken: true
        }
      })
    : null;
