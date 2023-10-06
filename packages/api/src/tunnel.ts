import { error } from "itty-router";

export class Tunnel implements DurableObject {
  private createdAt = Date.now();
  private uploader: WebSocket | null = null;

  constructor(private state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    const tunnelId = this.state.id.toString();
    const sessionId = request.headers.get("x-session-id");
    if (!sessionId) {
      console.error(
        { sessionId },
        "Missing internal headers in Tunnel DO request"
      );
      return error(500, "Internal error");
    }

    if (!this.uploader) {
      const upgrade = request.headers.get("Upgrade");
      if (!upgrade) return error(400, "Missing Upgrade header");
      if (upgrade !== "websocket") return error(400, "Invalid Upgrade header");

      const peer = new WebSocketPair();
      this.uploader = peer[0];

      this.uploader.addEventListener(
        "close",
        () => {
          console.error(
            { action: "Tunnel", sessionId, tunnelId },
            "Tunnel broken (closed by uploader)"
          );
          this.uploader = null;
        },
        { once: true }
      );
      this.uploader.addEventListener(
        "error",
        () => {
          console.error(
            { action: "Tunnel", sessionId, tunnelId },
            "Tunnel broken (unknown)"
          );
          this.uploader = null;
        },
        { once: true }
      );

      this.uploader.accept();
      console.info(
        { action: "Tunnel", sessionId, tunnelId },
        "Uploader connected"
      );
      return new Response(null, { status: 101, webSocket: peer[1] });
    }

    console.info(
      { action: "Tunnel", sessionId, tunnelId },
      "Beginning download"
    );

    const createdAt = this.createdAt;
    const uploader = this.uploader;
    uploader.addEventListener("close", (e) => stream.cancel(), { once: true });

    const stream = new ReadableStream<Uint8Array>(
      /* A ReadableStream source that reads a single file over a WebSocket connection.
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
       */

      {
        pull(controller) {
          // Return early if the stream is full, has errored, or has closed
          // https://developer.mozilla.org/en-US/docs/Web/API/ReadableByteStreamController/desiredSize
          if (controller.desiredSize === null) return controller.close(); // Stream has errored
          if (controller.desiredSize < 0) return; // Stream is full
          if (controller.desiredSize === 0) return controller.close(); // Stream is finished

          // It's going to make things a lot easier if we only pull one chunk at
          // a time (remember that one chunk is actually made up of multiple 1MiB
          // blocks because of DO WebSocket message limits), because we won't have
          // to deal with block ordering issues. In the future, it should be
          // possible to multiplex blocks from a bunch of chunks to speed up transfers,
          // but it isn't trivial, and I'd rather have _something_ working.
          // Returning a Promise here is how we signal to the ReadableStream to
          // only have one running `pull`
          return new Promise((resolve, reject) => {
            const listener = new AbortController();
            uploader.addEventListener(
              "close",
              () => {
                console.info(
                  { sessionId, tunnelId, duration: Date.now() - createdAt },
                  "Blob transfer complete"
                );
                controller.close();
                listener.abort();
              },
              { signal: listener.signal }
            );

            uploader.addEventListener(
              "message",
              (e) => {
                if (typeof e.data === "string") {
                  listener.abort();
                  return reject(1003);
                }

                if (e.data.byteLength === 0) {
                  // Chunk boundary, we can tell the ReadableStream to request
                  // the next chunk now
                  listener.abort();
                  return resolve();
                }

                // console.debug("Enqueueing", e.data.byteLength);
                controller.enqueue(new Uint8Array(e.data));
              },
              { signal: listener.signal }
            );

            // Request a chunk
            uploader.send("");
          });
        },
        cancel(reason) {
          return uploader.close(reason ?? 1001);
        },
      },
      {
        // highWaterMark: 50 * 1024 * 1024, // 50MiB, essentially how many bytes we'll buffer in memory
        highWaterMark: 5000, // Queue upto 10 chunks if the downloader is being slow
        size: (chunk) => chunk.byteLength,
      }
    );

    const filename = url.searchParams.get("n");
    const size = url.searchParams.get("s");
    const type = url.searchParams.get("ct");

    if (!filename || !size || !type) {
      console.trace(
        { sessionId, tunnelId, filename, size, type },
        "Missing request params"
      );
      return error(400, "Bad request params");
    }

    return new Response(stream, {
      status: 200,
      encodeBody: "manual",
      headers: {
        Connection: "close",
        "Content-Type": type,
        "Content-Length": size, // Technically always incorrect because of gzip, but Chromium treats this as a hint to show a real progress bar
        "Content-Disposition": `attachment; filename=\"${filename}\"`,
        "Content-Encoding": "gzip",
      },
    });
  }
}
