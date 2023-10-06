import {
  SessionMessageCode,
  deserializeSessionMessage,
  serializeSessionMessage,
} from "@blobs/protocol";
import { Router, error } from "itty-router";
import { Env } from "./worker";

export class Session implements DurableObject {
  constructor(
    private state: DurableObjectState,
    private env: Env
  ) {}

  async fetch(request: Request): Promise<Response> {
    return Router()
      .get("/session/connect", (request) => {
        const sessionId = this.state.id.toString();
        const rayId = request.headers.get("x-ray-id");
        if (!rayId) {
          console.error(
            { rayId },
            "Missing internal headers in Session DO request"
          );
          return error(500, "Internal error");
        }

        const upgrade = request.headers.get("Upgrade");
        if (!upgrade) return error(400, "Missing Upgrade header");
        if (upgrade !== "websocket")
          return error(400, "Invalid Upgrade header");

        this.state
          .getWebSockets()
          .filter((w) => w.readyState === WebSocket.READY_STATE_OPEN)
          .forEach((w) =>
            w.send(JSON.stringify({ code: SessionMessageCode.PeerConnected }))
          );

        const peer = new WebSocketPair();
        this.state.acceptWebSocket(peer[0]);

        this.state.setWebSocketAutoResponse(
          new WebSocketRequestResponsePair(
            JSON.stringify({ code: SessionMessageCode.Keepalive }),
            JSON.stringify({ code: SessionMessageCode.Keepalive })
          )
        );

        console.info(
          { action: "Session", rayId, sessionId },
          "Session connection established"
        );
        return new Response(null, { status: 101, webSocket: peer[1] });
      })
      .get("/session/tunnel/:tunnelId", (request) => {
        const sessionId = this.state.id.toString();
        const rayId = request.headers.get("x-ray-id");
        if (!rayId) {
          console.error(
            { action: "Tunnel", rayId, sessionId },
            "Missing internal headers in DO request"
          );
          return error(500, "Internal error");
        }

        const { tunnelId } = request.params;
        if (!tunnelId) {
          console.trace(
            { action: "Tunnel", rayId, sessionId },
            "Missing tunnelId"
          );
          return error(400, "Missing tunnelId");
        }

        this.state
          .getWebSockets()
          .filter((w) => w.readyState === WebSocket.READY_STATE_OPEN)
          .forEach((w) =>
            w.send(
              JSON.stringify({
                code: SessionMessageCode.TunnelCreated,
                tunnelId,
              })
            )
          );

        const headers = new Headers(request.headers);
        headers.set("x-ray-id", rayId);
        headers.set("x-session-id", sessionId);

        console.info(
          { action: "Tunnel", rayId, sessionId, tunnelId },
          "Forwarding to tunnel"
        );
        return this.env.tunnels
          .get(this.env.tunnels.idFromString(tunnelId))
          .fetch(request, { headers });
      })
      .handle(request, this.env)
      .catch((e) => {
        console.error(
          { error: (e as Error).message },
          "Internal error in Tunnel"
        );
        return error(500);
      });
  }

  async webSocketMessage(_ws: WebSocket, data: string) {
    const sessionId = this.state.id.toString();

    const message = deserializeSessionMessage(data);
    if (message.err) {
      console.error({ sessionId, message }, "Malformed session message");
      return;
    }

    if (message.val.code === SessionMessageCode.TunnelCreate) {
      const tunnelId = this.env.tunnels.newUniqueId();

      console.log({ sessionId, tunnelId }, "Tunnel created");
      return this.state.getWebSockets().forEach((ws) =>
        ws.send(
          serializeSessionMessage({
            code: SessionMessageCode.TunnelCreated,
            tunnelId: tunnelId.toString(),
          })
        )
      );
    }

    if (message.val.code === SessionMessageCode.TunnelReady) {
      const { tunnelId } = message.val;

      console.log({ sessionId, tunnelId }, "Tunnel ready");
      return this.state
        .getWebSockets()
        .forEach((ws) => ws.send(serializeSessionMessage(message.val)));
    }
  }

  webSocketClose() {
    const peers = this.state.getWebSockets();
    peers.forEach((ws) =>
      ws.send(
        serializeSessionMessage({ code: SessionMessageCode.PeerDisconnected })
      )
    );
  }
}
