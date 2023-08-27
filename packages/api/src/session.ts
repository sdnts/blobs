import {
  BlobMetadata,
  MessageCode,
  deserialize,
  serialize,
} from "@blobs/protocol";
import { customAlphabet } from "nanoid";
import { Ok, Result } from "ts-results";
import { Context } from "./context";
import { appendCookies } from "./cookie";
import { BlobError, errorToResponse, errors } from "./errors";
import { WebSocketSource } from "./stream";
import { Env } from "./worker";

export const CONNECTION_TIMEOUT = 1 * 60 * 60; // 1h
export const SESSION_TIMEOUT = 8 * 60 * 60; // 8h

const nanoid = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ", 6);

export class Session implements DurableObject {
  private sender?: WebSocket;
  private receiver?: WritableStreamDefaultWriter;

  constructor(
    private state: DurableObjectState,
    private env: Env
  ) {}

  async fetch(request: Request): Promise<Response> {
    const ctx = new Context(this.env, this.state.waitUntil);
    const url = new URL(request.url);

    ctx.setTags({
      rayId: request.headers.get("cf-ray") ?? undefined,
      actorId: this.state.id.toString(),
      method: request.method,
      path: url.pathname,
    });

    const { pathname } = new URL(request.url);
    let [_, action] = pathname.split("/");

    ctx.setTags({ action });

    try {
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

      ctx.setTags({ status: String(response.val.status) });

      if (response.err) return errorToResponse(response.val);
      return response.val;
    } catch (e) {
      const error = e as Error;
      return errorToResponse(
        errors.internalError(`Uncaught error: ${error.message}`).val
      );
    } finally {
      ctx.ship();
    }
  }

  async alarm(): Promise<void> {
    const ctx = new Context(this.env, this.state.waitUntil);
    ctx.setTags({ actorId: this.state.id.toString(), action: "nuke" });

    try {
      this.sender?.close();
      this.receiver?.close();
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
    let ip = request.headers.get("cf-connecting-ip");
    if (ctx.env.environment === "development") ip = "127.0.0.1";
    if (!ip) return errors.badRequest("Missing IP");

    // TODO: There's a significant possibility of collision, but only for
    // like 6RPS, which is far higher than I expect
    const secret = ctx.env.environment === "development" ? "000000" : nanoid();

    await ctx.env.metadata.put(secret, this.state.id.toString(), {
      expirationTtl: CONNECTION_TIMEOUT,
    });

    const sender = new WebSocketPair();
    this.sender = sender[0];

    this.sender.addEventListener("message", (e) => {
      if (!(e.data instanceof ArrayBuffer)) return;

      const message = deserialize(e.data);
      if (message.err) return;

      if (message.val.code === MessageCode.SecretRequest) {
        this.sender?.send(serialize({ code: MessageCode.Secret, secret }));
        return;
      }

      if (message.val.code !== MessageCode.Metadata) return;

      const { id, name, size, type } = message.val;

      const metadata: BlobMetadata = { id, name, size, type };
      this.receiver?.write(
        new TextEncoder().encode(`data: ${JSON.stringify(metadata)}\n\n`)
      );

      void this.state.storage.put<BlobMetadata>(`blob:${id}`, metadata);
    });

    // Prepare to nuke after the session timeout
    this.state.storage.setAlarm(Date.now() + SESSION_TIMEOUT * 1000);

    this.sender.accept();
    return Ok(
      new Response(null, {
        status: 101,
        webSocket: sender[1],
        headers: await appendCookies(new Headers(), this.state.id, ip, ctx),
      })
    );
  }

  async Join(
    request: Request,
    ctx: Context
  ): Promise<Result<Response, BlobError>> {
    const origin = request.headers.get("origin");

    let ip = request.headers.get("cf-connecting-ip");
    if (ctx.env.environment === "development") ip = "127.0.0.1";
    if (!ip) return errors.badRequest("Missing IP");

    const response = new IdentityTransformStream();
    this.receiver = response.writable.getWriter();

    this.sender?.send(serialize({ code: MessageCode.ReceiverJoined }));

    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("s");
    if (!secret) return errors.badRequest("Missing secret");

    // Prevent anyone else from joining without a cookie
    void ctx.env.metadata.delete(secret);

    // Defer nuking by the session timeout
    this.state.storage.setAlarm(Date.now() + SESSION_TIMEOUT * 1000);

    return Ok(
      new Response(response.readable, {
        headers: await appendCookies(
          new Headers({
            "Access-Control-Allow-Origin": origin!,
            "Content-Type": "text/event-stream",
          }),
          this.state.id,
          ip,
          ctx
        ),
      })
    );
  }

  async Download(
    request: Request,
    ctx: Context
  ): Promise<Result<Response, BlobError>> {
    if (!this.sender) return errors.unknown("No sender connected");

    const { searchParams } = new URL(request.url);

    const idString = searchParams.get("id");
    if (!idString) return errors.badRequest("Blob ID is required");
    const id = Number.parseInt(idString);
    if (Number.isNaN(id))
      return errors.badRequest(`Blob ID is malformed: ${idString}`);

    const metadata = await this.state.storage.get<BlobMetadata>(`blob:${id}`);
    if (!metadata) return errors.notFound("No such blob");

    console.log("Downloading", JSON.stringify(metadata, null, 2));

    const readable = new ReadableStream<Uint8Array>(
      new WebSocketSource(this.sender, id),
      {
        highWaterMark: 10 * 1024 * 1024, // 10MiB
        size: (chunk) => chunk.byteLength,
      }
    );

    return Ok(
      new Response(readable, {
        status: 200,
        encodeBody: "manual",
        headers: {
          Connection: "close",
          "Content-Length": `${metadata.size}`,
          "Content-Type": metadata.type,
          "Content-Disposition": `attachment; filename=\"${metadata.name}\"`,
          "Content-Encoding": "gzip",
        },
      })
    );
  }
}
