import { writable } from "svelte/store";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { browser } from "$app/environment";

export const user = writable<User | null>(null);
export const emailVerified = writable<boolean>(false);

export async function signUp(
  email: string,
  password: string,
  displayName: string
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
      },
    },
  });

  if (error) throw error;

  // Profile creation will be handled automatically when the user first creates a game
  // via the API routes which check and create profiles as needed

  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  // Profile sync will be handled automatically when needed by API routes
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function resendVerification(email: string) {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email,
  });

  if (error) throw error;
  return true;
}

export function initAuth() {
  if (!browser) return;

  // Get initial session
  supabase.auth.getSession().then(({ data: { session } }) => {
    user.set(session?.user ?? null);
    emailVerified.set(session?.user?.email_confirmed_at ? true : false);
  });

  // Listen for auth changes
  supabase.auth.onAuthStateChange(async (event, session) => {
    user.set(session?.user ?? null);
    emailVerified.set(session?.user?.email_confirmed_at ? true : false);

    // Handle email confirmation
    if (event === "SIGNED_IN" && session?.user?.email_confirmed_at) {
      emailVerified.set(true);
    }
  });
}
