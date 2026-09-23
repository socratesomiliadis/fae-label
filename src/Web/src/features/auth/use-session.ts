import { useEffect, useState } from "react";
import { api, post } from "@/lib/api";
import type { User } from "@/types/records";

export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    api<User>("/me", { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted) setUser(value);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setReady(true);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    const interval = setInterval(() => {
      api("/me", { signal: controller.signal })
        .then(() => {
          if (!controller.signal.aborted) setOffline(false);
        })
        .catch(() => {
          if (!controller.signal.aborted) setOffline(true);
        });
    }, 15_000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [user]);

  function login(value: User) {
    setUser(value);
    setOffline(false);
    setError("");
  }

  async function logout() {
    try {
      await post("/logout", {});
      setUser(null);
      setError("");
    } catch (error) {
      setError((error as Error).message);
    }
  }

  return { user, ready, offline, error, login, logout };
}
