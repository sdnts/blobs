// @vitest-environment edge-runtime

import { expect, test } from "vitest";
import { sign, verify } from "../src/auth";

test("sign", async () => {
  const token = await sign("1", "abcd", "1.1.1.1", {
    secret: "wishiwasacookie",
  });
  expect(token).not.toBeUndefined();

  const [peerId, tunnelId, ip, signature] = token.split("|");
  expect(peerId).toBe("1");
  expect(tunnelId).toBe("abcd");
  expect(ip).toBe("1.1.1.1");
  expect(signature).not.toBeUndefined();
});

test("verify", async () => {
  const env = { secret: "wishiwasacookie" };
  const token = await sign("2", "abcd", "1.1.1.1", env);

  const auth = await verify(token, env);
  expect(auth).not.toBe(false);
  if (auth === false) return; // To please TypeScript

  expect(auth.peerId).toBe("2");
  expect(auth.tunnelId).toBe("abcd");
  expect(auth.ip).toBe("1.1.1.1");
});

test("verify (invalid peerId)", async () => {
  const env = { secret: "wishiwasacookie" };
  const token = await sign("nonsense", "abcd", "1.1.1.1", env);

  const auth = await verify(token, env);
  expect(auth).toBe(false);
});

test("verify (invalid tunnelId)", async () => {
  const env = { secret: "wishiwasacookie" };
  const token = await sign("1", "", "1.1.1.1", env);

  const auth = await verify(token, env);
  expect(auth).toBe(false);
});

test("verify (invalid ip)", async () => {
  const env = { secret: "wishiwasacookie" };
  const token = await sign("1", "abcd", "", env);

  const auth = await verify(token, env);
  expect(auth).toBe(false);
});

test("verify (invalid signature)", async () => {
  const env = { secret: "wishiwasacookie" };
  const token = await sign("1", "abcd", "1.1.1.1", env);
  const tokenParts = token.split("|");

  const auth = await verify(
    [tokenParts[0], tokenParts[1], tokenParts[2], "bogus"].join("|"),
    env
  );
  expect(auth).toBe(false);
});
