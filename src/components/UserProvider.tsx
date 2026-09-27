"use client";

import { createContext, useContext, useEffect, useState, useCallback, Suspense, ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// The session-activity pinger (MP-006, extended MP-007). /api/auth/me winds the 60-minute
// inactivity clock (src/lib/auth.ts touchSession). MP-006 keyed the refetch on usePathname()
// alone, so a reader browsing the /sold chips or the /listings filters — which change only the
// search params, not the path — never touched the session and was signed out mid-visit
// (MC-044). This keys it on the search string too. It lives in its own component wrapped in
// Suspense because useSearchParams() opts a component into client rendering; isolating it here
// keeps every page under this provider server-rendered (the three rules: best-in-class SEO).
function RouteActivity({ onChange }: { onChange: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? "";
  useEffect(() => {
    onChange();
  }, [onChange, pathname, search]);
  return null;
}

interface UserData {
  id: string;
  email: string;
  firstName: string | null;
  savedListings: string[];
}

interface UserContextType {
  user: UserData | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  saveListing: (mlsNumber: string) => Promise<void>;
  unsaveListing: (mlsNumber: string) => Promise<void>;
  isListingSaved: (mlsNumber: string) => boolean;
}

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
  saveListing: async () => {},
  unsaveListing: async () => {},
  isListingSaved: () => false,
});

export function useUser() {
  return useContext(UserContext);
}

export default function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      setUser(data.user || null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  };

  const saveListing = async (mlsNumber: string) => {
    const res = await fetch("/api/auth/save-listing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mlsNumber, action: "save" }),
    });
    const data = await res.json();
    if (data.savedListings) {
      setUser((prev) => prev ? { ...prev, savedListings: data.savedListings } : null);
    }
  };

  const unsaveListing = async (mlsNumber: string) => {
    const res = await fetch("/api/auth/save-listing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mlsNumber, action: "remove" }),
    });
    const data = await res.json();
    if (data.savedListings) {
      setUser((prev) => prev ? { ...prev, savedListings: data.savedListings } : null);
    }
  };

  const isListingSaved = (mlsNumber: string) => {
    return user?.savedListings?.includes(mlsNumber) || false;
  };

  return (
    <UserContext.Provider value={{ user, loading, refresh, logout, saveListing, unsaveListing, isListingSaved }}>
      <Suspense fallback={null}>
        <RouteActivity onChange={refresh} />
      </Suspense>
      {children}
    </UserContext.Provider>
  );
}
