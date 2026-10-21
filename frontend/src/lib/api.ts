"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type ApiInit = Omit<RequestInit, "body"> & { json?: unknown; body?: BodyInit };

export async function api<T = unknown>(path: string, init: ApiInit = {}): Promise<T> {
  const { json, ...rest } = init;
  const headers = new Headers(rest.headers);
  let body = rest.body;
  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(json);
  }
  const res = await fetch(path, { ...rest, headers, body, credentials: "include", cache: "no-store" });
  const isAuthCall = path.startsWith("/api/auth/") || path.startsWith("/api/public/");
  if (res.status === 401 && !isAuthCall && typeof window !== "undefined") {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
  if (!res.ok) {
    let message = res.statusText || "Request failed";
    try {
      const data = await res.json();
      if (typeof data.detail === "string") message = data.detail;
      else if (Array.isArray(data.detail))
        message = data.detail.map((d: { msg?: string; loc?: string[] }) => `${d.loc?.slice(-1)[0] ?? ""}: ${d.msg}`).join("; ");
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function useApi<T>(path: string | null, options: { pollMs?: number; poll?: (data: T) => boolean } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(!!path);
  const pollRef = useRef(options.poll);
  pollRef.current = options.poll;

  const load = useCallback(
    async (silent = false) => {
      if (!path) return;
      if (!silent) setLoading(true);
      try {
        setData(await api<T>(path));
        setError("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [path],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!options.pollMs || !data) return;
    if (pollRef.current && !pollRef.current(data)) return;
    const id = setInterval(() => load(true), options.pollMs);
    return () => clearInterval(id);
  }, [data, load, options.pollMs]);

  return { data, error, loading, reload: load, setData };
}
