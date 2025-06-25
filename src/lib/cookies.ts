// Cookie utility functions for guest session persistence

export interface CookieOptions {
  expires?: Date;
  maxAge?: number;
  path?: string;
  domain?: string;
  secure?: boolean;
  sameSite?: "strict" | "lax" | "none";
  httpOnly?: boolean;
}

/**
 * Set a cookie with the given name, value, and options
 */
export function setCookie(
  name: string,
  value: string,
  options: CookieOptions = {}
): void {
  if (typeof document === "undefined") return; // SSR safety

  let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

  if (options.expires) {
    cookieString += `; expires=${options.expires.toUTCString()}`;
  }

  if (options.maxAge) {
    cookieString += `; max-age=${options.maxAge}`;
  }

  if (options.path) {
    cookieString += `; path=${options.path}`;
  }

  if (options.domain) {
    cookieString += `; domain=${options.domain}`;
  }

  if (options.secure) {
    cookieString += `; secure`;
  }

  if (options.sameSite) {
    cookieString += `; samesite=${options.sameSite}`;
  }

  if (options.httpOnly) {
    cookieString += `; httponly`;
  }

  document.cookie = cookieString;
}

/**
 * Get a cookie value by name
 */
export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null; // SSR safety

  const nameEQ = `${encodeURIComponent(name)}=`;
  const cookies = document.cookie.split(";");

  for (let cookie of cookies) {
    cookie = cookie.trim();
    if (cookie.indexOf(nameEQ) === 0) {
      return decodeURIComponent(cookie.substring(nameEQ.length));
    }
  }

  return null;
}

/**
 * Delete a cookie by name
 */
export function deleteCookie(
  name: string,
  options: Pick<CookieOptions, "path" | "domain"> = {}
): void {
  setCookie(name, "", {
    ...options,
    expires: new Date(0),
  });
}

/**
 * Save guest session data with both localStorage and cookie fallback
 */
export function saveGuestSession(
  gameId: string,
  email: string,
  displayName?: string
): void {
  const sessionData = {
    email,
    displayName: displayName || email.split("@")[0],
    timestamp: Date.now(),
  };

  const sessionValue = JSON.stringify(sessionData);

  // Save to localStorage (primary storage)
  try {
    localStorage.setItem(`guest-session-${gameId}`, sessionValue);
  } catch (error) {
    console.warn("Failed to save to localStorage:", error);
  }

  // Also save to cookie as fallback (expires in 30 days)
  try {
    setCookie(`guest-session-${gameId}`, sessionValue, {
      maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
      path: "/",
      sameSite: "lax",
    });
  } catch (error) {
    console.warn("Failed to save to cookie:", error);
  }
}

/**
 * Load guest session data from localStorage or cookie
 */
export function loadGuestSession(
  gameId: string
): { email: string; displayName: string } | null {
  // Try localStorage first
  try {
    const localData = localStorage.getItem(`guest-session-${gameId}`);
    if (localData) {
      const parsed = JSON.parse(localData);
      return {
        email: parsed.email,
        displayName: parsed.displayName || parsed.email.split("@")[0],
      };
    }
  } catch (error) {
    console.warn("Failed to load from localStorage:", error);
  }

  // Fallback to cookie
  try {
    const cookieData = getCookie(`guest-session-${gameId}`);
    if (cookieData) {
      const parsed = JSON.parse(cookieData);

      // Also restore to localStorage if available
      try {
        localStorage.setItem(`guest-session-${gameId}`, cookieData);
      } catch (error) {
        // Ignore localStorage errors
      }

      return {
        email: parsed.email,
        displayName: parsed.displayName || parsed.email.split("@")[0],
      };
    }
  } catch (error) {
    console.warn("Failed to load from cookie:", error);
  }

  return null;
}

/**
 * Clear guest session data from both localStorage and cookie
 */
export function clearGuestSession(gameId: string): void {
  // Clear localStorage
  try {
    localStorage.removeItem(`guest-session-${gameId}`);
  } catch (error) {
    // Ignore errors
  }

  // Clear cookie
  try {
    deleteCookie(`guest-session-${gameId}`, { path: "/" });
  } catch (error) {
    // Ignore errors
  }
}
