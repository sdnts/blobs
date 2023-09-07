import {
  BlobMetadata,
  MessageCode,
  deserialize,
  serialize,
} from "@blobs/protocol";
import { Router, error } from "itty-router";
import { Context } from "./context";
import { TunnelRequest, withAction, withIp, withTags } from "./middleware";
import { WebSocketSource } from "./stream";
import { Env } from "./worker";

export class Tunnel implements DurableObject {
  constructor(
    private state: DurableObjectState,
    private env: Env
  ) { }

  async fetch(request: Request): Promise<Response> {
    const ctx = new Context(this.env, this.state.waitUntil);

    return Router<TunnelRequest, [Context]>()
      .get("/tunnel", withIp(), withTags(), withAction("tunnel"), this.Tunnel)
      .get(
        "/download",
        withIp(),
        withTags(),
        withAction("download"),
        this.Download
      )
      .all("*", () => error(500, "Bad pathname"))
      .handle(request, ctx)
      .then((response) => {
        ctx.tag({ status: String(response.status) });
        return response;
      })
      .catch((e) => {
        ctx.error(`Uncaught error: ${(e as Error).message}`);
        return error(500, `Uncaught error: ${(e as Error).message}`);
      })
      .finally(() => ctx.ship());
  }

  async webSocketMessage(_ws: WebSocket, data: string | ArrayBuffer) {
    if (!(data instanceof ArrayBuffer)) return;

    const message = deserialize(data);
    if (message.err) return;

    if (message.val.code !== MessageCode.Metadata) return;

    await this.state.storage.put<BlobMetadata>(
      `blob:${message.val.id.owner}:${message.val.id.id}`,
      message.val
    );

    this.state.getWebSockets().forEach((ws) => ws.send(serialize(message.val)));
  }

  webSocketClose() {
    const peers = this.state.getWebSockets();
    if (peers.length === 0) this.state.storage.deleteAll();
  }

  // ---

  private Tunnel = (request: TunnelRequest, _ctx: Context): Response => {
    const upgrade = request.headers.get("Upgrade");
    if (!upgrade) return error(400, "Missing Upgrade header");
    if (upgrade !== "websocket") return error(400, "Invalid Upgrade header");

    const peers = this.state.getWebSockets();

    const peerId = `${peers.length}`;
    const peer = new WebSocketPair();

    this.state
      .getWebSockets()
      .forEach((ws) => ws.send(serialize({ code: MessageCode.PeerConnected })));

    this.state.acceptWebSocket(peer[0], [peerId]);
    return new Response(null, { status: 101, webSocket: peer[1] });
  };

  private Download = async (
    request: TunnelRequest,
    ctx: Context
  ): Promise<Response> => {
    const owner = request.query.o;
    if (!owner) return error(400, "Blob owner is required");
    if (Array.isArray(owner)) return error(400, "Multiple blob owners");

    const id = request.query.i;
    if (!id) return error(400, "Blob ID is required");
    if (Array.isArray(id)) return error(400, "Multiple blob IDs");

    const metadata = await this.state.storage.get<BlobMetadata>(
      `blob:${owner}:${id}`
    );
    if (!metadata) return error(404, "No such blob");

    ctx.tag({ blobId: metadata.id.id, peerId: metadata.id.owner });

    const source = this.state.getWebSockets(metadata.id.owner);
    if (!source) return error(500, "Unknown peer in metadata");

    const blob = new ReadableStream<Uint8Array>(
      new WebSocketSource(source[0], metadata.id),
      {
        highWaterMark: 10 * 1024 * 1024, // 10MiB
        size: (chunk) => chunk.byteLength,
      }
    );

    return new Response(blob, {
      status: 200,
      encodeBody: "manual",
      headers: {
        Connection: "close",
        "Content-Length": `${metadata.size}`,
        "Content-Type": metadata.type,
        "Content-Disposition": `attachment; filename=\"${metadata.name}\"`,
        "Content-Encoding": "gzip",
      },
    });
  };
}
