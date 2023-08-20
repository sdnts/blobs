import { MessageCode, deserialize, serialize } from "@blobs/protocol";
import { Ok, Result } from "ts-results";
import { Context } from "./context";
import { BlobError, errorToResponse, errors } from "./errors";
import { Env } from "./worker";

export const CONNECTION_TIMEOUT = 10 * 60 * 1000; // 10m
export const SESSION_TIMEOUT = 6 * 60 * 60 * 1000; // 6h

type BlobMetadata = {
  size: number;
};

export class Session implements DurableObject {
  private sender?: WebSocket;
  private receiver?: WritableStreamDefaultWriter;

  constructor(
    private state: DurableObjectState,
    private env: Env
  ) {}

  async fetch(request: Request): Promise<Response> {
    const ctx = new Context(this.env, this.state.waitUntil);
    ctx.setTags({
      url: request.url,
      rayId: request.headers.get("cf-ray") ?? undefined,
    });

    const { pathname } = new URL(request.url);
    let [_, sessionId, action] = pathname.split("/");
    if (pathname === "/new") action = "new";

    ctx.setTags({ action });

    let response: Result<Response, BlobError>;
    switch (action) {
      case "new":
        response = await this.New(request, ctx);
        break;
      case "join":
        response = await this.Join(request, ctx);
        break;
      case "download":
        response = await this.Download(request, ctx);
        break;
      default:
        response = errors.badRequest(`No route for ${pathname}`);
    }

    ctx.ship();

    if (response.err) return errorToResponse(response.val);
    return response.val;
  }

  async alarm(): Promise<void> {
    const ctx = new Context(this.env, this.state.waitUntil);
    ctx.setTags({ action: "nuke" });

    try {
      this.sender?.close();
      await this.state.storage.deleteAll();

      ctx.ship();
    } catch (e) {
      // If something goes wrong, try again in a minute
      this.state.storage.setAlarm(Date.now() + 1 * 60 * 1000); // 1m
    }
  }

  async New(
    request: Request,
    ctx: Context
  ): Promise<Result<Response, BlobError>> {
    const sender = new WebSocketPair();
    this.sender = sender[0];

    this.sender.addEventListener("message", (e) => {
      if (!(e.data instanceof ArrayBuffer)) return;

      const message = deserialize(new Uint8Array(e.data));
      if (message.err) return;
      if (message.val.code !== MessageCode.Metadata) return;

      const { name, size } = message.val;

      this.receiver?.write(
        new TextEncoder().encode(
          `data: ${JSON.stringify({
            name,
            size: String(size),
          })}\n\n`
        )
      );

      void this.state.storage.put<BlobMetadata>(`blob:${name}`, { size });
    });

    // Prepare to nuke if no one connects within the connection timeout
    this.state.storage.setAlarm(Date.now() + CONNECTION_TIMEOUT);

    this.sender.accept();
    return Ok(
      new Response(null, {
        status: 101,
        webSocket: sender[1],
      })
    );
  }

  async Join(
    request: Request,
    ctx: Context
  ): Promise<Result<Response, BlobError>> {
    // Defer nuking by the session timeout
    this.state.storage.setAlarm(Date.now() + SESSION_TIMEOUT);

    const origin = request.headers.get("Origin");
    const response = new IdentityTransformStream();
    this.receiver = response.writable.getWriter();

    this.sender?.send(serialize({ code: MessageCode.Joined }));

    return Ok(
      new Response(response.readable, {
        headers: {
          "Access-Control-Allow-Origin": origin!,
          "Content-Type": "text/event-stream",
        },
      })
    );
  }

  async Download(
    request: Request,
    ctx: Context
  ): Promise<Result<Response, BlobError>> {
    const url = new URL(request.url);

    const encodedName = url.searchParams.get("name");
    if (!encodedName) return errors.badRequest("Blob name is required");
    const name = decodeURIComponent(encodedName);

    const blob = await this.state.storage.get<BlobMetadata>(`blob:${name}`);
    if (!blob) return errors.notFound("No such blob");

    const { size } = blob;

    const { readable, writable } = new IdentityTransformStream();
    const response = writable.getWriter();

    this.sender?.addEventListener("message", (e) => {
      if (!(e.data instanceof ArrayBuffer)) return;

      const message = deserialize(new Uint8Array(e.data));
      if (message.err) return;

      if (message.val.code === MessageCode.Data) {
        response.write(message.val.bytes);
      }
      if (message.val.code === MessageCode.Sent) {
        response.close();
      }
    });
    this.sender?.send(serialize({ code: MessageCode.Request, name }));

    return Ok(
      new Response(readable, {
        status: 200,
        encodeBody: "manual",
        headers: {
          "Content-Length": `${size}`,
          "Content-Encoding": "gzip",
          "Content-Disposition": `attachment; filename=\"${name}\"`,
        },
      })
    );
  }
}
