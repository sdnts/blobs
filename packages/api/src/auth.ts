import { Env } from "./worker";

export async function sign(
  sessionId: string,
  ip: string,
  env: Pick<Env, "authSecret">
): Promise<string> {
  const te = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    te.encode(env.authSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const token = `${sessionId}|${ip}`;
  const signature = await crypto.subtle.sign("HMAC", key, te.encode(token));

  return (
    token +
    "|" +
    btoa(String.fromCharCode(...new Uint8Array(signature))).replaceAll("=", "")
  );
}

type Session = { sessionId: string; ip: string };
export async function verify(
  token: string,
  env: Pick<Env, "authSecret">
): Promise<false | Session> {
  const [sessionId, ip] = token.split("|");
  if (!ip) return false;
  if (!sessionId) return false;

  const signedToken = await sign(sessionId, ip, env);
  if (signedToken === token) return { sessionId, ip };
  return false;
}
