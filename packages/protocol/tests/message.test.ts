import { describe, expect, test } from "vitest";
import { Message, MessageCode, deserialize, serialize } from "../src";

describe("Message", () => {
  test.each<[string, Message]>([
    ["SecretRequest", { code: MessageCode.SecretRequest }],
    ["Secret", { code: MessageCode.Secret, secret: "696969" }],
    ["ReceiverJoined", { code: MessageCode.ReceiverJoined }],
    [
      "Metadata",
      {
        code: MessageCode.Metadata,
        id: 1,
        name: "signature",
        size: 24,
        type: "text/plain",
      },
    ],
    [
      "Metadata",
      {
        code: MessageCode.Metadata,
        id: 2,
        name: "name:with:colons",
        size: 10,
        type: "application/json",
      },
    ],
    [
      "Metadata",
      {
        code: MessageCode.Metadata,
        id: 3,
        name: "Spider.Man.Across.The.Spiderverse.mov",
        size: 500 * 1024 * 1024, // 500 MiB
        type: "video/mov",
      },
    ],
    ["DataRequest", { code: MessageCode.DataRequest, id: 1 }],
    [
      "DataChunk",
      {
        code: MessageCode.DataChunk,
        id: 2,
        offset: 0,
        bytes: new Uint8Array([1, 2, 3, 4]),
      },
    ],
    [
      "DataChunk",
      {
        code: MessageCode.DataChunk,
        id: 3,
        offset: 128,
        bytes: new Uint8Array(65536),
      },
    ],
    [
      "DataChunkEnd",
      {
        code: MessageCode.DataChunkEnd,
        id: 3,
      },
    ],
    ["Keepalive", { code: MessageCode.Keepalive }],
  ])("%s", (_, message: Message) => {
    const serialized = serialize(message);
    const deserialized = deserialize(serialized);

    expect(deserialized.ok).toBeTruthy();
    expect(deserialized.val).toEqual(message);
    expect((deserialized.val as Message).code).toEqual(message.code);
  });
});
