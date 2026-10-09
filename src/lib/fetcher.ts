export class ApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function fetcher<T>(url: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (init?.body && !(init.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(url, {
    ...init,
    headers: { ...headers, ...(init?.headers as Record<string, string>) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(body.error || "Request failed", body.code, res.status);
  }
  return res.json() as Promise<T>;
}

export async function uploadFile(
  file: File,
  bucket: string,
  extra?: Record<string, string>
): Promise<{ _id: string; filename: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("bucket", bucket);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) formData.append(k, v);
  }
  const res = await fetch("/api/files/upload", { method: "POST", body: formData });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(body.error || "Upload failed", body.code, res.status);
  }
  return res.json();
}

export function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}
