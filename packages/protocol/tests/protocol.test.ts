import { describe, expect, test } from "vitest";
import { Message, MessageCode, deserialize, serialize } from "../src";

describe("self-compat", () => {
  test.each<[string, Message]>([
    ["Joined", { code: MessageCode.Joined }],
    ["Metadata", { code: MessageCode.Metadata, name: "signature", size: 24 }],
    [
      "Metadata",
      { code: MessageCode.Metadata, name: "name:with:colons", size: 10 },
    ],
    [
      "Metadata",
      {
        code: MessageCode.Metadata,
        name: "Spider.Man.Across.The.Spiderverse.mov",
        size: 500 * 1024 * 1024, // 500 MiB
      },
    ],
    ["Request", { code: MessageCode.Request, name: "secrets.txt" }],
    [
      "Data",
      {
        code: MessageCode.Data,
        length: 4,
        bytes: new Uint8Array([1, 2, 3, 4]),
      },
    ],
    [
      "Data",
      {
        code: MessageCode.Data,
        length: 64 * 1024, // 64 KiB
        bytes: new Uint8Array(65536),
      },
    ],
    ["Sent", { code: MessageCode.Sent }],
    ["Keepalive", { code: MessageCode.Keepalive }],
  ])("%s", (_, message: Message) => {
    const serialized = serialize(message);
    const deserialized = deserialize(serialized);

    expect(deserialized.ok).toBeTruthy();
    expect(deserialized.val).toEqual(message);
    expect((deserialized.val as Message).code).toEqual(message.code);
  });
});
