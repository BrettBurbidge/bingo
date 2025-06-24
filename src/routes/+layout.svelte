<script lang="ts">
  import "../app.css";
  import { onMount } from "svelte";
  import { initAuth, user, signOut, emailVerified } from "$lib/auth";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import Button from "$lib/components/ui/button.svelte";
  import { Badge } from "$lib/components/ui/badge";
  import { Separator } from "$lib/components/ui/separator";
  import EmailVerificationBanner from "$lib/components/EmailVerificationBanner.svelte";

  onMount(() => {
    initAuth();
  });

  async function handleSignOut() {
    try {
      await signOut();
      goto("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  }

  $: isHomePage = $page.url.pathname === "/";
</script>

<div class="min-h-screen bg-background">
  {#if $user && !isHomePage}
    <!-- Authenticated layout with improved navigation -->
    <header
      class="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      <div class="container flex h-14 max-w-screen-2xl items-center">
        <div class="mr-4 hidden md:flex">
          <a class="mr-6 flex items-center space-x-2" href="/dashboard">
            <div
              class="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground"
            >
              <span class="text-sm font-bold">CB</span>
            </div>
            <span class="hidden font-bold sm:inline-block">Bingo</span>
          </a>
          <nav class="flex items-center gap-6 text-sm">
            <a
              href="/dashboard"
              class="transition-colors hover:text-foreground/80 {$page.url
                .pathname === '/dashboard'
                ? 'text-foreground'
                : 'text-foreground/60'}"
            >
              Dashboard
            </a>
          </nav>
        </div>

        <!-- Mobile menu button -->
        <div
          class="flex flex-1 items-center justify-between space-x-2 md:justify-end"
        >
          <div class="w-full flex-1 md:w-auto md:flex-none">
            <a
              class="mr-6 flex items-center space-x-2 md:hidden"
              href="/dashboard"
            >
              <div
                class="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground"
              >
                <span class="text-sm font-bold">CB</span>
              </div>
              <span class="font-bold">Bingo</span>
            </a>
          </div>

          <nav class="flex items-center gap-2">
            <div class="hidden md:flex items-center gap-2 text-sm">
              <Badge variant="secondary" class="px-2 py-1">
                {$user.user_metadata?.display_name || $user.email}
              </Badge>
              {#if !$emailVerified}
                <Badge variant="outline" class="px-2 py-1 bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700">
                  ⚠️ Unverified
                </Badge>
              {/if}
            </div>
            <Button variant="ghost" size="sm" on:click={handleSignOut}>
              Sign Out
            </Button>
          </nav>
        </div>
      </div>
    </header>
    
    <!-- Email Verification Banner -->
    <EmailVerificationBanner />
  {/if}

  <main class={$user && !isHomePage ? "container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl" : ""}>
    <slot />
  </main>
</div>
