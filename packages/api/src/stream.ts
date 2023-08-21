import { MessageCode, deserialize, serialize } from "@blobs/protocol";
import { Context } from "./context";

/**
 * A ReadableByteStream source that reads remote files over a WebSocket connection.
 *
 * Think of this source as creating a stream pipe over a WebSocket connection.
 * When pulled, this source requests a single chunk of data over the WebSocket,
 * which obliges by in turn reading another chunk of the file in question. This
 * byte chunk is instantly enqueued to the stream.
 * The backpressure mechanism here is very simple as well, we just stop reading
 * from the WebSocket if the stream signals an unsuitable backpressure.
 *
 * The source supports file multiplexing by attaching a unique identifier to each
 * file, and using that when requesting chunks. The WebSocket connection also uses
 * this identifier to advance the correct FileReader on its end. This is inspired
 * by HTTP/2's multiplexing system. It's simple and elegant.
 *
 * There are lots of opportunities for improvements here:
 * 1. In the future, it might be useful to build in a retry mechanism, but that
 *    can only work for the last transmitted chunk. That may be enough though.
 * 2. It'll also be nice to deal with WebSocket reconnects. Currently, encountering
 *    a `close` event just cancels the stream.
 * 3. An UnderlyingByteSource might be more efficient here to do zero-copy
 *    transfers. This is a low-hanging fruit I think.
 *
 *
 * So why do we do these shenanigans instead of creating a real stream pipe from
 * the sender's FileReader to the receiver's Response?
 * Cloudflare has limits on request body sizes (300 MiB). To stream these chunks
 * to the receiver then, we cannot rely on the Web Streams API's backpressure control
 * (because, well, there is no stream chain), and must build our own.
 */
export class WebSocketSource implements UnderlyingSource {
  /**
   * A handle to the WebSocket this source is reading from.
   */
  #ws: WebSocket;
  #ctx: Context;

  constructor(ws: WebSocket, ctx: Context) {
    this.#ctx = ctx;

    this.#ctx.log("Constructing WebSocketSource");
    this.#ws = ws;
  }

  pull(controller: ReadableStreamDefaultController): void | Promise<void> {
    this.#ctx.log(`Pull ${controller.desiredSize}`);

    // Return early if the stream is full, has errored, or has closed
    // https://developer.mozilla.org/en-US/docs/Web/API/ReadableByteStreamController/desiredSize
    if (controller.desiredSize === null) return;
    if (controller.desiredSize === 0) return;
    if (controller.desiredSize < 0) return;

    const wsListener = new AbortController();

    // Return a Promise to prevent concurrent pulls by the ReadableSource
    // (is that even possible from JS?)
    return new Promise<void>((resolve, reject) => {
      this.#ws.addEventListener("close", reject, { signal: wsListener.signal });
      this.#ws.addEventListener("error", reject, { signal: wsListener.signal });
      this.#ws.addEventListener(
        "message",
        (e) => {
          this.#ctx.log("Received message from sender");
          if (!(e.data instanceof ArrayBuffer)) return;

          const message = deserialize(e.data);
          if (message.err) return reject("Deserialization error");
          if (message.val.code === MessageCode.DataChunkEnd) {
            this.#ctx.log("DataChunkEnd, resolving");
            return resolve();
          }
          if (message.val.code !== MessageCode.DataChunk) return;
          if (message.val.bytes.length === 0) {
            this.#ctx.log("DataChunk 0 bytes, finished");
            controller.close();
            return resolve();
          }

          controller.enqueue(message.val.bytes);
        },
        { signal: wsListener.signal }
      );

      // Fill up the overflow buffer
      this.#ctx.log("Requesting data");
      this.#ws.send(serialize({ code: MessageCode.DataRequest, id: 0 }));
    })
      .catch((e) => {
        console.error("WebSocketSource error", e);
        controller.close();
      })
      .finally(() => {
        wsListener.abort();
      });
  }

  cancel(reason: any): void {
    this.#ws.close();
  }
}

// -----
// ReadableStream AsyncIterator Shim
// -----

declare global {
  interface ReadableStream<R = any> {
    [Symbol.asyncIterator](): AsyncGenerator<
      { done: true } | { done: false; value: R },
      void
    >;
  }
}

ReadableStream.prototype[Symbol.asyncIterator] = async function* <R>() {
  const self: ReadableStream<R> = this;
  const reader = self.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
};
