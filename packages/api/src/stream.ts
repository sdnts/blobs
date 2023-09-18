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
  controller?: ReadableStreamDefaultController;
  pullPromise?: { resolve: () => void; reject: () => void };

  constructor(
    private ws: WebSocket,
    public id: BlobId
  ) {}

  pull(controller: ReadableStreamDefaultController): void | Promise<void> {
    // Return early if the stream is full, has errored, or has closed
    // https://developer.mozilla.org/en-US/docs/Web/API/ReadableByteStreamController/desiredSize
    if (controller.desiredSize === null) return controller.close(); // Stream has errored
    if (controller.desiredSize < 0) return; // Stream is full
    if (controller.desiredSize === 0) return controller.close(); // Stream is finished

    if (this.ws.readyState !== WebSocket.READY_STATE_OPEN) return;

    // Return a Promise here so that `pull` isn't called again till we've enqueued
    // a full file chunk (which may arrive in multiple messages because of the
    // 1MiB DO WS message limit)
    // This is required for proper backpressure control.
    // TODO: Are we utilizing the stream to its full potential here or are we
    // constantly enqueue-ing fewer bytes than we can?
    return new Promise((resolve, reject) => {
      this.ws.send(serialize({ code: MessageCode.DataRequest, id: this.id }));

      this.controller = controller;
      this.pullPromise = { resolve, reject };
    });
  }

  cancel(): void {
    this.ws.close();

    this.controller?.close();
    this.controller = undefined;
    this.pullPromise?.reject();
    this.pullPromise = undefined;
  }

  // Since we're using hibernatable DOs, WebSocket messages get delivered to the
  // DO instead of the WS instance, so we have to rely on the DO letting us know
  // when that happens. Practically speaking though, a DO should not hibernate
  // between multiple pulls of the same WebSocketSource instance, since there
  // will always be sufficient WS activity (aka the file being downloaded)

  webSocketMessage = (message: Message) => {
    if (!this.controller || !this.pullPromise) return;

    if (message.code === MessageCode.DataChunk) {
      if (message.bytes.length === 0) {
        this.controller.close();
        this.pullPromise.resolve();

        this.controller = undefined;
        this.pullPromise = undefined;
        return;
      }

      return this.controller.enqueue(message.bytes);
    }

    if (message.code === MessageCode.DataChunkEnd) {
      this.pullPromise.resolve();

      this.controller = undefined;
      this.pullPromise = undefined;
    }
  };

  webSocketClose = () => {
    if (!this.controller || !this.pullPromise) return;

    this.controller.close();
    this.pullPromise.reject();
    this.pullPromise = undefined;
  };
}
