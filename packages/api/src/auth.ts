import { Context } from "./context";

export async function sign(
  peerId: string,
  tunnelId: string,
  ip: string,
  env: Pick<Context["env"], "secret">
): Promise<string> {
  const te = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    te.encode(env.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const token = `${peerId}|${tunnelId}|${ip}`;
  const signature = await crypto.subtle.sign("HMAC", key, te.encode(token));

  return (
    token +
    "|" +
    btoa(String.fromCharCode(...new Uint8Array(signature))).replaceAll("=", "")
  );
}

export async function verify(
  token: string,
  env: Pick<Context["env"], "secret">
): Promise<false | { peerId: string; tunnelId: string; ip: string }> {
  const [peerId, tunnelId, ip] = token.split("|");
  if (!peerId || (peerId !== "1" && peerId !== "2")) return false;
  if (!ip) return false;
  if (!tunnelId) return false;

  const signedToken = await sign(peerId, tunnelId, ip, env);
  if (signedToken === token) return { peerId, tunnelId, ip };
  return false;
}
