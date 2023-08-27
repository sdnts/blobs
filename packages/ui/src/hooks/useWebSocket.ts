import { Message, MessageCode, deserialize, serialize } from "@blobs/protocol";
import { useEffect, useRef } from "react";
import { useSenderStore } from "../store";

const WS_SCHEME = import.meta.env.PUBLIC_API_HOST.startsWith("localhost")
  ? "ws://"
  : "wss://";
const WS_HOST = import.meta.env.PUBLIC_API_HOST;

type Params = {
  onOpen?: (e: Event) => void;
  onMessage?: (e: Message) => void;
  onError?: (e: Event) => void;
  onClose?: (e: CloseEvent) => void;
};

export function useWebSocket({
  onOpen,
  onMessage,
  onError,
  onClose,
}: Params = {}) {
  const setState = useSenderStore((s) => s.setState);

  const messageBuffer = useRef<Message[]>([]);
  const websocket = useRef<WebSocket>();

  useEffect(() => {
    let keepalive: NodeJS.Timer;
    const abort = new AbortController();
    const ws = new WebSocket(`${WS_SCHEME}${WS_HOST}/new`);
    setState("connecting");

    ws.addEventListener(
      "open",
      (e) => {
        onOpen?.(e);

        setState("waiting");
        ws.send(serialize({ code: MessageCode.SecretRequest }));

        keepalive = setInterval(
          () => ws.send(serialize({ code: MessageCode.Keepalive })),
          10_000
        );

        messageBuffer.current.forEach((m) => ws.send(serialize(m)));
        messageBuffer.current = [];
      },
      { signal: abort.signal }
    );

    ws.addEventListener(
      "message",
      async (e) => {
        if (!(e.data instanceof Blob)) return;

        const data = await e.data.arrayBuffer();
        const message = deserialize(new Uint8Array(data));
        if (message.err) return;

        onMessage?.(message.val);
      },
      { signal: abort.signal }
    );

    ws.addEventListener(
      "error",
      (e) => {
        setState("disconnected");
        onError?.(e);
      },
      { signal: abort.signal }
    );

    ws.addEventListener(
      "close",
      (e) => {
        setState("disconnected");
        onClose?.(e);
      },
      { signal: abort.signal }
    );

    websocket.current = ws;

    return () => {
      abort.abort();
      clearInterval(keepalive);
      ws.close();
    };
  }, []);

  return {
    send: (message: Message) => {
      if (
        !websocket.current ||
        websocket.current.readyState === WebSocket.CONNECTING
      ) {
        console.log("Buffering message", message);
        messageBuffer.current.push(message);
        return;
      }

      console.log("Sending message", message);
      websocket.current.send(serialize(message));
    },
  };
}
