import { describe, expect, test } from "vitest";
import { Message, MessageCode, deserialize, serialize } from "../src";

describe("Message", () => {
  test.each<[string, Message]>([
    ["PeerConnected", { code: MessageCode.PeerConnected }],
    ["PeerDisconnected", { code: MessageCode.PeerDisconnected }],
    [
      "Metadata",
      {
        code: MessageCode.Metadata,
        id: { owner: "9999", id: "1" },
        name: "signature",
        size: 24,
        type: "text/plain",
      },
    ],
    [
      "Metadata",
      {
        code: MessageCode.Metadata,
        id: { owner: "9999", id: "1" },
        name: "name:with:colons",
        size: 10,
        type: "application/json",
      },
    ],
    [
      "Metadata",
      {
        code: MessageCode.Metadata,
        id: { owner: "9999", id: "1" },
        name: "Spider.Man.Across.The.Spiderverse.mov",
        size: 500 * 1024 * 1024, // 500 MiB
        type: "video/mov",
      },
    ],
    [
      "DataRequest",
      {
        code: MessageCode.DataRequest,
        id: { owner: "9999", id: "1" },
      },
    ],
    [
      "DataChunk",
      {
        code: MessageCode.DataChunk,
        id: { owner: "9999", id: "1" },
        offset: 0,
        bytes: new Uint8Array([1, 2, 3, 4]),
      },
    ],
    [
      "DataChunk",
      {
        code: MessageCode.DataChunk,
        id: { owner: "9999", id: "1" },
        offset: 128,
        bytes: new Uint8Array(65536),
      },
    ],
    [
      "DataChunkEnd",
      {
        code: MessageCode.DataChunkEnd,
        id: { owner: "9999", id: "1" },
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
