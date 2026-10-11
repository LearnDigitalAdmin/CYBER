import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import { auth } from "../../../services/firebaseService";

/** The signed-in Firebase user: `undefined` while Firebase starts, `null` when signed out. */
export function useAuthUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u)), []);
  return user;
}

export const hasPasswordSignIn = (u: User): boolean => u.providerData.some((p) => p.providerId === "password");

export function browserStore(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}
