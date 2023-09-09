import { BlobId, Message, MessageCode, serialize } from "@blobs/protocol";
import { ReadableStreamDefaultController } from "@cloudflare/workers-types/experimental";

/**
 * A ReadableByteStream source that reads a single file over a WebSocket connection.
 *
 * Think of this source as creating a stream pipe over a WebSocket connection.
 * When pulled, this source requests a single chunk of a file over the WebSocket.
 * The client then advances its own ReadableStream over the file in question,
 * reading and returning a single chunk. This byte chunk is instantly enqueued
 * to the stream.
 * The backpressure mechanism is very simple as well, if the source stops pulling,
 * we stop sending WebSocket messages, and the client stops reading more of the
 * file.
 *
 * There are lots of opportunities for improvements here:
 * 1. In the future, it might be useful to build in a retry mechanism, but that
 *    can only work for the last transmitted chunk. That may be enough though.
 * 2. It'll also be nice to deal with WebSocket reconnects. Currently, encountering
 *    a `close` event just cancels the stream.
 * 3. An UnderlyingByteSource might be more efficient here to do zero-copy
 *    transfers. This is a low-hanging fruit I think.
 *
 * So why did we write our own UnderlyingSource instead of creating a real stream
 * pipe from the sender's FileReader to the receiver's Response?
 * Cloudflare has limits on request body sizes (300 MiB). With a real stream pipe,
 * we'd be limited to transferring files under that size as well.
 * We hack around this by transporting raw file chunks over a WebSocket. That has
 * its own problem though. Durable Object WebSocket messages have a 1MiB size limit
 * as well (but there can be as many of them as we want). Our client takes care
 * of this by making sure it only sends us 1MiB parts of a single file chunk at
 * a time.
 *
 * Another issue is that we're using Hibertable WebSockets, which means WebSocket
 * messages get delivered to the DO directly, so we cannot set up our own listeners
 * in this source itself, which causes some inconvenient indirection, but it mostly
 * works.
 *
 * The general flow of messages looks like this:
 *  ┌─────────────────┐
 *  │ Workers Runtime │
 *  └─────────────────┘
 *           │ pull()
 *           ▼
 *  ┌─────────────────┐                                ┌─────────────────┐
 *  │ Durable Object  │───MessageCode.DataRequest─────▶│     Browser     │
 *  └─────────────────┘                                └─────────────────┘
 *                      ◀──── MessageCode.DataChunk ───
 *                      ◀──── MessageCode.DataChunk ───
 *                      ◀──── MessageCode.DataChunk ───
 *                      ◀──MessageCode.DataChunkEnd ───
 */
export class WebSocketSource implements UnderlyingSource {
  /**
   * A handle to the WebSocket this source is reading from.
   */
  #id: BlobId;
  #ws: WebSocket;
  controller?: ReadableStreamDefaultController;
  pullResolve?: () => void;
  pullReject?: () => void;

  constructor(ws: WebSocket, id: BlobId) {
    this.#id = id;
    this.#ws = ws;
  }

  pull(controller: ReadableStreamDefaultController): void | Promise<void> {
    // Return early if the stream is full, has errored, or has closed
    // https://developer.mozilla.org/en-US/docs/Web/API/ReadableByteStreamController/desiredSize
    if (controller.desiredSize === null) return; // Stream has errored
    if (controller.desiredSize < 0) return; // Stream is full
    if (controller.desiredSize === 0) return controller.close(); // Stream is finished

    this.#ws.send(serialize({ code: MessageCode.DataRequest, id: this.#id }));
    this.controller = controller;

    // Return a Promise here so that `pull` isn't called again till we've enqueued
    // a single file chunk (which may arrive in multiple messages because of the
    // 1MiB DO WS message limit)
    // This is required for proper backpressure control.
    // TODO: Are we utilizing the stream to its full potential here or are we
    // constantly enqueue-ing fewer bytes than we can?
    return new Promise((resolve, reject) => {
      this.pullResolve = resolve;
      this.pullReject = reject;
    });
  }

  cancel(): void {
    this.#ws.close();
  }

  // ---

  webSocketMessage = (message: Message) => {
    if (message.code === MessageCode.DataChunk) {
      if (message.bytes.length === 0) {
        this.controller?.close();
        this.pullResolve?.();
        return;
      }

      return this.controller?.enqueue(message.bytes);
    }

    if (message.code === MessageCode.DataChunkEnd) {
      return this.pullResolve?.();
    }
  };

  onClose() {
    this.controller?.close();
    this.pullReject?.();
  }
}
