import {
  BlobId,
  BlobMetadata,
  MessageCode,
  deserialize,
  serialize,
} from "@blobs/protocol";
import { IRequestStrict, Router, error } from "itty-router";
import { WebSocketSource } from "./stream";
import { Env } from "./worker";

export class Tunnel implements DurableObject {
  private downloads: Array<{ id: BlobId; stream: WebSocketSource }> = [];

  constructor(
    private state: DurableObjectState,
    private env: Env
  ) {}

  async fetch(request: Request): Promise<Response> {
    return Router()
      .get("/tunnel", this.Tunnel)
      .get("/download", this.Download)
      .handle(request, this.env)
      .catch((e) => {
        console.error(
          { error: (e as Error).message },
          "Internal error in Tunnel"
        );
        return error(500);
      });
  }

  async webSocketMessage(_ws: WebSocket, data: string | ArrayBuffer) {
    if (!(data instanceof ArrayBuffer)) return;

    const message = deserialize(data);
    if (message.err) return;

    if (message.val.code === MessageCode.Metadata) {
      await this.state.storage.put<BlobMetadata>(
        `blob:${message.val.id.owner}:${message.val.id.id}`,
        message.val
      );

      // Relay metadata to the _other_ websocket
      return this.state
        .getWebSockets(message.val.id.owner === "1" ? "2" : "1")
        .forEach((ws) => ws.send(serialize(message.val)));
    }

    if (
      message.val.code !== MessageCode.DataChunk &&
      message.val.code !== MessageCode.DataChunkEnd
    ) {
      return;
    }

    const blobId = message.val.id;
    const downloadIdx = this.downloads.findIndex(
      (d) => d.id.owner === blobId.owner && d.id.id === blobId.id
    );
    if (downloadIdx === -1) return;

    this.downloads[downloadIdx].stream.webSocketMessage(message.val);

    if (
      message.val.code === MessageCode.DataChunk &&
      message.val.bytes.byteLength === 0
    ) {
      // This download has finished, get rid of it
      this.downloads.splice(downloadIdx, 1);
    }
  }

  webSocketClose() {
    const peers = this.state.getWebSockets();
    peers.forEach((ws) =>
      ws.send(serialize({ code: MessageCode.PeerDisconnected }))
    );

    if (peers.length === 0) void this.state.storage.deleteAll();
  }

  // ---

  private Tunnel = (request: IRequestStrict): Response => {
    const tunnelId = this.state.id.toString();
    const peerId = request.headers.get("x-peer-id");
    const rayId = request.headers.get("x-ray-id");
    if (!peerId || !rayId) {
      console.error(
        { rayId, peerId },
        "Missing internal headers in DO request"
      );
      return error(500, "Internal error");
    }

    const upgrade = request.headers.get("Upgrade");
    if (!upgrade) return error(400, "Missing Upgrade header");
    if (upgrade !== "websocket") return error(400, "Invalid Upgrade header");

    const peers = this.state
      .getWebSockets()
      .filter((w) => w.readyState === WebSocket.READY_STATE_OPEN);
    if (peers.length >= 2) return error(403, "Tunnel is full");

    peers.forEach((ws) =>
      ws.send(serialize({ code: MessageCode.PeerConnected }))
    );

    const peer = new WebSocketPair();
    this.state.acceptWebSocket(peer[0], [peerId]);

    console.info(
      { action: "Tunnel", rayId, tunnelId, peerId },
      "Tunnel connection established"
    );
    return new Response(null, { status: 101, webSocket: peer[1] });
  };

  private Download = async (request: IRequestStrict): Promise<Response> => {
    const tunnelId = this.state.id.toString();
    const peerId = request.headers.get("x-peer-id");
    const rayId = request.headers.get("x-ray-id");
    if (!peerId || !rayId) {
      console.error(
        { rayId, peerId },
        "Missing internal headers in DO request"
      );
      return error(500, "Internal error");
    }

    const owner = request.query.o;
    if (!owner) return error(400, "Blob owner is required");
    if (Array.isArray(owner)) return error(400, "Multiple blob owners");
    if (owner !== "1" && owner !== "2") return error(400, "Invalid blob owner");

    const id = request.query.i;
    if (!id) return error(400, "Blob ID is required");
    if (Array.isArray(id)) return error(400, "Multiple blob IDs");

    const metadata = await this.state.storage.get<BlobMetadata>(
      `blob:${owner}:${id}`
    );
    if (!metadata) return error(404, "No such blob");

    const source = this.state
      .getWebSockets(owner)
      .filter((w) => w.readyState === WebSocket.READY_STATE_OPEN);
    if (!source) return error(500, "Unknown peer in metadata");
    if (source.length > 1) return error(500, "Too many sources");

    const stream = new WebSocketSource(source[0], metadata.id);
    const blob = new ReadableStream<Uint8Array>(stream, {
      highWaterMark: 50 * 1024 * 1024, // 50MiB, essentially how many bytes we'll buffer in memory
      size: (chunk) => chunk.byteLength,
    });

    this.downloads.push({ id: { owner, id }, stream });

    // TODO: We cannot know the correct content-length of the file because it is
    // compressed by the uploader. I'd have liked to know this so I can set the
    // Content-Length header here and have the browser show a download progress
    // bar, but that doesn't sound possible without buffering the entire file
    // on the uploader's browser :/
    // We could have done this to set the Content-Length header:
    // blob.pipeThrough(new FixedLengthStream(metadata.size))

    console.info(
      {
        action: "Download",
        rayId,
        tunnelId,
        peerId,
        blobId: metadata.id.id,
        owner: metadata.id.owner,
      },
      "Downloading"
    );
    return new Response(blob, {
      status: 200,
      encodeBody: "manual",
      headers: {
        Connection: "close",
        "Content-Type": metadata.type,
        "Content-Disposition": `attachment; filename=\"${metadata.name}\"`,
        "Content-Encoding": "gzip",
      },
    });
  };
}
