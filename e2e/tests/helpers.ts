export const API = process.env.API_URL ?? "http://localhost:4000";
export const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";
export const WEB = process.env.WEB_URL ?? "http://localhost:3000";
export const MOBILE = process.env.MOBILE_URL ?? "http://localhost:8081";

export const LANDLORD = { email: "landlord@campusliving.local", password: "Password123!" };

export async function api<T>(method: string, path: string, body?: unknown, token?: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body !== undefined && { "content-type": "application/json" }),
      ...(token && { authorization: `Bearer ${token}` }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = res.status === 204 ? undefined : await res.json();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(data)}`);
  return data as T;
}

/** Polls Mailpit for the newest OTP sent to `email`. */
export async function readOtp(email: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}&limit=1`);
    const { messages } = (await res.json()) as { messages: { Subject: string }[] };
    const code = messages?.[0]?.Subject.match(/(\d{6})/)?.[1];
    if (code) return code;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No OTP email for ${email}`);
}

// Smallest valid PDF, for document uploads.
export const tinyPdf = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);
