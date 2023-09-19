import { expect } from "vitest";
import { test } from "./setup";

test("can join existing tunnels", async ({ worker }) => {
    let res = await worker.fetch("/new", { method: "PUT" });
    let body = (await res.json()) as Record<string, string>;
    const secret = body.secret;

    res = await worker.fetch(`/join?s=${secret}`, { method: "PUT" });
    expect(res.status).toBe(200);

    body = (await res.json()) as Record<string, string>;

    expect(body.secret).toBeUndefined();

    expect(body.token).not.toBeUndefined();
    const [peerId, actorId, ip, signature] = body.token.split("|");
    expect(peerId).not.toBeUndefined();
    expect(actorId).not.toBeUndefined();
    expect(ip).not.toBeUndefined();
    expect(signature).not.toBeUndefined();
});
