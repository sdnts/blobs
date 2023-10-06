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

    // We expect the uploader to be the first request to this tunnel, and the
    // downloader to be the second

    if (!this.uploader) {
      const upgrade = request.headers.get("Upgrade");
      if (!upgrade) return error(400, "Missing Upgrade header");
      if (upgrade !== "websocket") return error(400, "Invalid Upgrade header");

      const peer = new WebSocketPair();
      this.uploader = peer[0];

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
          // a time. The client is smart enough to concatenate multiple file
          // chunks into a 1MiB chunk (DO WebSocket message limit).
          // This way, we won't have to deal with chunk ordering issues (imagine
          // we `pull()` three chunks, we must write chunks in the same order we
          // request them so the download makes sense).
          // In the future, it should be possible to multiplex pulls by branding
          // chunks (similarto HTP/2 multiplexing) to speed up transfers, but it
          // isn't trivial, and I'd rather have _something_ working.
          // Returning a Promise here is how we signal to the ReadableStream to
          // only have one running `pull` at a time.
          return new Promise((resolve, reject) => {
            const listeners = new AbortController();

            uploader.addEventListener(
              "close",
              () => {
                console.info(
                  { sessionId, tunnelId, duration: Date.now() - createdAt },
                  "Blob transfer complete"
                );
                controller.close();
                listeners.abort();
                return resolve();
              },
              { signal: listeners.signal }
            );

            uploader.addEventListener(
              "message",
              (e) => {
                if (typeof e.data === "string") {
                  console.debug("Malformed message, aborting");
                  listeners.abort();
                  controller.error(1003);
                  return reject(1003);
                }

                console.debug("Enqueueing", e.data.byteLength);
                controller.enqueue(new Uint8Array(e.data));
                console.debug("Enqueued", e.data.byteLength);

                listeners.abort();
                return resolve();
              },
              { signal: listeners.signal }
            );

            // Request a chunk
            console.debug("Requesting chunk");
            uploader.send("");
          });
        },
        cancel(reason) {
          console.debug({ reason }, "Stream cancelled");
          return uploader.close(reason ?? 1001);
        },
      },
      {
        // Queue upto 10 chunks in memory if the downloader is
        // being slow. This roughly translates to 10MiB
        highWaterMark: 1,
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
        // Technically always incorrect because of gzip, but Chromium treats this
        // as a hint to show a real progress bar for this download
        "Content-Length": size,
        "Content-Disposition": `attachment; filename=\"${filename}\"`,
        "Content-Encoding": "gzip",
      },
    });
  }
}
