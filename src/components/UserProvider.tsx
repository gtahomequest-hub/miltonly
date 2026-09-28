"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { usePathname } from "next/navigation";

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

  // On mount and on every client-side navigation (MP-006). /api/auth/me is where the 60-minute
  // inactivity clock is wound (src/lib/auth.ts touchSession): a person clicking through the
  // /sold chips or the /listings pages under this one root layout is active, and without the
  // pathname here the fetch ran once per hard load and the clock ran out on them mid-visit.
  const pathname = usePathname();
  useEffect(() => {
    refresh();
  }, [refresh, pathname]);

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
      {children}
    </UserContext.Provider>
  );
}
