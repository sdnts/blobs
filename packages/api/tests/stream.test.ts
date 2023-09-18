import { BlobId, MessageCode } from "@blobs/protocol";
import { ReadableStreamDefaultController } from "@cloudflare/workers-types/experimental";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { WebSocketSource } from "../src/stream";

const ws: WebSocket = {
  url: "",
  protocol: "",
  extensions: "",
  readyState: 1,
  accept: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
  send: vi.fn(),
  serializeAttachment: vi.fn(),
  deserializeAttachment: vi.fn(),
};

beforeEach(() => {
  vi.stubGlobal("WebSocket", {
    READY_STATE_OPEN: 1,
  });
});

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

test("does not enqueue chunks when stream is full", async () => {
  const source = new WebSocketSource(ws, { owner: "1", id: "1" });
  const controller: ReadableStreamDefaultController = {
    desiredSize: -20,
    close: vi.fn(),
    error: vi.fn(),
    enqueue: vi.fn(),
  };
  source.pull(controller);

  expect(controller.close).toHaveBeenCalledTimes(0);
  expect(controller.error).toHaveBeenCalledTimes(0);
  expect(controller.enqueue).toHaveBeenCalledTimes(0);
});

test("does not enqueue chunks when stream has finished", async () => {
  const source = new WebSocketSource(ws, { owner: "1", id: "1" });
  const controller: ReadableStreamDefaultController = {
    desiredSize: 0,
    close: vi.fn(),
    error: vi.fn(),
    enqueue: vi.fn(),
  };
  source.pull(controller);

  expect(controller.close).toHaveBeenCalledTimes(1);
  expect(controller.error).toHaveBeenCalledTimes(0);
  expect(controller.enqueue).toHaveBeenCalledTimes(0);
});

test("bails if stream has errored", async () => {
  const source = new WebSocketSource(ws, { owner: "1", id: "1" });
  const controller: ReadableStreamDefaultController = {
    desiredSize: null,
    close: vi.fn(),
    error: vi.fn(),
    enqueue: vi.fn(),
  };
  source.pull(controller);

  expect(controller.close).toHaveBeenCalledTimes(1);
  expect(controller.error).toHaveBeenCalledTimes(0);
  expect(controller.enqueue).toHaveBeenCalledTimes(0);
});

test("can pull a single file chunk", async () => {
  const controller: ReadableStreamDefaultController = {
    desiredSize: 1024,
    close: vi.fn(),
    error: vi.fn(),
    enqueue: vi.fn(),
  };
  const blobId: BlobId = { owner: "1", id: "1" };

  const source = new WebSocketSource(ws, blobId);
  source.pull(controller);

  expect(ws.send).toHaveBeenCalledTimes(1);
  expect(controller.enqueue).toHaveBeenCalledTimes(0);
  vi.resetAllMocks();

  let bytes = new Uint8Array(10);
  source.webSocketMessage({
    code: MessageCode.DataChunk,
    id: blobId,
    bytes,
    offset: 0,
  });

  expect(ws.send).toHaveBeenCalledTimes(0);
  expect(controller.enqueue).toHaveBeenCalledTimes(1);
  expect(controller.enqueue).toHaveBeenCalledWith(bytes);
  vi.resetAllMocks();

  bytes = new Uint8Array(10);
  source.webSocketMessage({
    code: MessageCode.DataChunk,
    id: blobId,
    bytes,
    offset: 10,
  });
  expect(ws.send).toHaveBeenCalledTimes(0);
  expect(controller.enqueue).toHaveBeenCalledTimes(1);
  expect(controller.enqueue).toHaveBeenCalledWith(bytes);
  vi.resetAllMocks();

  bytes = new Uint8Array(10);
  source.webSocketMessage({
    code: MessageCode.DataChunk,
    id: blobId,
    bytes,
    offset: 20,
  });
  expect(ws.send).toHaveBeenCalledTimes(0);
  expect(controller.enqueue).toHaveBeenCalledTimes(1);
  expect(controller.enqueue).toHaveBeenCalledWith(bytes);
  vi.resetAllMocks();

  source.webSocketMessage({
    code: MessageCode.DataChunkEnd,
    id: blobId,
  });
  expect(ws.send).toHaveBeenCalledTimes(0);
  expect(controller.enqueue).toHaveBeenCalledTimes(0);
});

test("can pull multiple file chunks", async () => {
  const controller: ReadableStreamDefaultController = {
    desiredSize: 1024,
    close: vi.fn(),
    error: vi.fn(),
    enqueue: vi.fn(),
  };
  const blobId: BlobId = { owner: "1", id: "1" };

  const source = new WebSocketSource(ws, blobId);

  // Chunk 1
  source.pull(controller);

  expect(ws.send).toHaveBeenCalledTimes(1);
  expect(controller.enqueue).toHaveBeenCalledTimes(0);
  vi.resetAllMocks();

  let bytes = new Uint8Array(10);
  source.webSocketMessage({
    code: MessageCode.DataChunk,
    id: blobId,
    bytes,
    offset: 0,
  });

  expect(ws.send).toHaveBeenCalledTimes(0);
  expect(controller.enqueue).toHaveBeenCalledTimes(1);
  expect(controller.enqueue).toHaveBeenCalledWith(bytes);
  vi.resetAllMocks();

  source.webSocketMessage({
    code: MessageCode.DataChunkEnd,
    id: blobId,
  });
  expect(ws.send).toHaveBeenCalledTimes(0);
  expect(controller.enqueue).toHaveBeenCalledTimes(0);
  vi.resetAllMocks();

  // Chunk 2
  source.pull(controller);

  expect(ws.send).toHaveBeenCalledTimes(1);
  expect(controller.enqueue).toHaveBeenCalledTimes(0);
  vi.resetAllMocks();

  bytes = new Uint8Array(20);
  source.webSocketMessage({
    code: MessageCode.DataChunk,
    id: blobId,
    bytes,
    offset: 0,
  });

  expect(ws.send).toHaveBeenCalledTimes(0);
  expect(controller.enqueue).toHaveBeenCalledTimes(1);
  expect(controller.enqueue).toHaveBeenCalledWith(bytes);
  vi.resetAllMocks();

  bytes = new Uint8Array(20);
  source.webSocketMessage({
    code: MessageCode.DataChunkEnd,
    id: blobId,
  });
  expect(ws.send).toHaveBeenCalledTimes(0);
  expect(controller.enqueue).toHaveBeenCalledTimes(0);
  vi.resetAllMocks();
});

test("can end stream when file ends", async () => {
  const controller: ReadableStreamDefaultController = {
    desiredSize: 1024,
    close: vi.fn(),
    error: vi.fn(),
    enqueue: vi.fn(),
  };
  const blobId: BlobId = { owner: "1", id: "1" };

  const source = new WebSocketSource(ws, blobId);

  // Chunk 1
  source.pull(controller);

  expect(ws.send).toHaveBeenCalledTimes(1);
  expect(controller.enqueue).toHaveBeenCalledTimes(0);
  vi.resetAllMocks();

  let bytes = new Uint8Array(10);
  source.webSocketMessage({
    code: MessageCode.DataChunk,
    id: blobId,
    bytes,
    offset: 0,
  });

  expect(ws.send).toHaveBeenCalledTimes(0);
  expect(controller.enqueue).toHaveBeenCalledTimes(1);
  expect(controller.enqueue).toHaveBeenCalledWith(bytes);
  vi.resetAllMocks();

  source.webSocketMessage({
    code: MessageCode.DataChunkEnd,
    id: blobId,
  });
  expect(ws.send).toHaveBeenCalledTimes(0);
  expect(controller.enqueue).toHaveBeenCalledTimes(0);
  vi.resetAllMocks();

  // End of file
  source.pull(controller);

  expect(ws.send).toHaveBeenCalledTimes(1);
  expect(controller.enqueue).toHaveBeenCalledTimes(0);
  vi.resetAllMocks();

  source.webSocketMessage({
    code: MessageCode.DataChunk,
    id: blobId,
    bytes: new Uint8Array(0),
    offset: 0,
  });
  expect(ws.send).toHaveBeenCalledTimes(0);
  expect(controller.enqueue).toHaveBeenCalledTimes(0);
  expect(controller.close).toHaveBeenCalledTimes(1);
});

test("can end stream when it is cancelled", async () => {
  const controller: ReadableStreamDefaultController = {
    desiredSize: 1024,
    close: vi.fn(),
    error: vi.fn(),
    enqueue: vi.fn(),
  };
  const blobId: BlobId = { owner: "1", id: "1" };

  const source = new WebSocketSource(ws, blobId);

  const pull = source.pull(controller);
  expect(ws.send).toHaveBeenCalledTimes(1);
  expect(controller.enqueue).toHaveBeenCalledTimes(0);
  vi.resetAllMocks();

  let bytes = new Uint8Array(10);
  source.webSocketMessage({
    code: MessageCode.DataChunk,
    id: blobId,
    bytes,
    offset: 0,
  });

  expect(ws.send).toHaveBeenCalledTimes(0);
  expect(controller.enqueue).toHaveBeenCalledTimes(1);
  expect(controller.enqueue).toHaveBeenCalledWith(bytes);
  vi.resetAllMocks();

  // Cancel the stream
  source.cancel();
  expect(pull).rejects.toBe(undefined);

  expect(controller.close).toHaveBeenCalledTimes(1);
  expect(controller.enqueue).toHaveBeenCalledTimes(0);
  expect(ws.close).toHaveBeenCalledTimes(1);
});

test("can end stream when websocket client disconnects", async () => {
  const controller: ReadableStreamDefaultController = {
    desiredSize: 1024,
    close: vi.fn(),
    error: vi.fn(),
    enqueue: vi.fn(),
  };
  const blobId: BlobId = { owner: "1", id: "1" };

  const source = new WebSocketSource(ws, blobId);

  const pull = source.pull(controller);
  expect(ws.send).toHaveBeenCalledTimes(1);
  expect(controller.enqueue).toHaveBeenCalledTimes(0);
  vi.resetAllMocks();

  let bytes = new Uint8Array(10);
  source.webSocketMessage({
    code: MessageCode.DataChunk,
    id: blobId,
    bytes,
    offset: 0,
  });

  expect(ws.send).toHaveBeenCalledTimes(0);
  expect(controller.enqueue).toHaveBeenCalledTimes(1);
  expect(controller.enqueue).toHaveBeenCalledWith(bytes);
  vi.resetAllMocks();

  // Close WS
  source.webSocketClose();
  expect(pull).rejects.toBe(undefined);

  expect(controller.close).toHaveBeenCalledTimes(1);
  expect(controller.enqueue).toHaveBeenCalledTimes(0);
});
