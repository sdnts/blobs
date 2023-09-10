// @vitest-environment edge-runtime

import { expect, test } from "vitest";
import { sign, verify } from "../src/auth";

test("sign", async () => {
  const token = await sign("abcd", "1.1.1.1", { secret: "wishiwasacookie" });
  expect(token).not.toBeUndefined();

  const [tunnelId, ip, signature] = token.split("|");
  expect(tunnelId).toBe("abcd");
  expect(ip).toBe("1.1.1.1");
  expect(signature).not.toBeUndefined();
});

test("verify", async () => {
  const env = { secret: "wishiwasacookie" };
  const token = await sign("abcd", "1.1.1.1", env);

  const auth = await verify(token, env);
  expect(auth).not.toBe(false);
  if (auth === false) return; // To please TypeScript

  expect(auth.tunnelId).toBe("abcd");
  expect(auth.ip).toBe("1.1.1.1");
});
