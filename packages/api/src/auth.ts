import { Context } from "./context";

export async function sign(
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

  const token = `${tunnelId}|${ip}`;
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
): Promise<false | { tunnelId: string; ip: string }> {
  const [tunnelId, ip] = token.split("|");
  const signedToken = await sign(tunnelId, ip, env);
  if (signedToken === token) return { tunnelId, ip };
  return false;
}
