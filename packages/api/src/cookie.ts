import { Ok, Result } from "ts-results";
import { Context } from "./context";
import { BlobError, errors } from "./errors";
import { CONNECTION_TIMEOUT } from "./session";

export async function appendCookies(
  headers: Headers,
  id: DurableObjectId,
  ip: string,
  secret: string,
  ctx: Context
): Promise<Headers> {
  headers.append(
    "Set-Cookie",
    [
      `auth=${await encrypt(`${id.toString()}:${ip}`, ctx)}`,
      `HttpOnly`,
      ctx.env.environment === "production" ? `Secure` : "",
      `Max-Age=${CONNECTION_TIMEOUT}`,
    ].join("; ")
  );

  headers.append(
    "Set-Cookie",
    [
      `secret=${secret}`,
      ctx.env.environment === "production" ? `Secure` : "",
      `Max-Age=${CONNECTION_TIMEOUT}`,
    ].join("; ")
  );

  console.log(JSON.stringify(Array.from(headers.entries())), null, 2);

  return headers;
}

// Adapted from: https://gist.github.com/chrisveness/43bcda93af9f646d083fad678071b90a

export async function encrypt(actorId: string, ctx: Context): Promise<string> {
  const te = new TextEncoder();

  const secretHash = await crypto.subtle.digest(
    "SHA-256",
    te.encode(ctx.env.secret)
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ivString = Array.from(iv)
    .map((b) => String.fromCharCode(b))
    .join("");

  const algorithm = { name: "AES-GCM", iv };

  const key = await crypto.subtle.importKey(
    "raw",
    secretHash,
    algorithm,
    false,
    ["encrypt"]
  );

  const ciphertext = await crypto.subtle.encrypt(
    algorithm,
    key,
    te.encode(actorId)
  );

  const ciphertextString = Array.from(new Uint8Array(ciphertext))
    .map((byte) => String.fromCharCode(byte))
    .join("");

  return btoa(ivString + ciphertextString);
}

export async function decrypt(
  ciphertext: string,
  ctx: Context
): Promise<Result<string, BlobError>> {
  const te = new TextEncoder();
  const td = new TextDecoder();

  const secretHash = await crypto.subtle.digest(
    "SHA-256",
    te.encode(ctx.env.secret)
  );

  const ivString = atob(ciphertext).slice(0, 12);
  const iv = new Uint8Array(Array.from(ivString).map((c) => c.charCodeAt(0)));

  const algorithm = { name: "AES-GCM", iv };

  const key = await crypto.subtle.importKey(
    "raw",
    secretHash,
    algorithm,
    false,
    ["decrypt"]
  );

  const ciphertextString = atob(ciphertext).slice(12);

  try {
    const plaintext = await crypto.subtle.decrypt(
      algorithm,
      key,
      // For some reason using te.encode(ciphertextString) fails to decrypt
      new Uint8Array(Array.from(ciphertextString).map((c) => c.charCodeAt(0)))
    );
    return Ok(td.decode(plaintext));
  } catch (e) {
    return errors.internalError("");
  }
}
