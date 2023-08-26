import { MessageCode, type Message } from "@blobs/protocol";
import { useRef } from "react";
import { useReceiverStore } from "../state";

const ES_HOST = import.meta.env.PUBLIC_API_HOST;

type Options = {
  onOpen?: (e: Event) => void;
  onMessage?: (e: Message) => void;
  onError?: (e: Event) => void;
  onClose?: (e: CloseEvent) => void;
};

export function useSSE({ onOpen, onMessage, onError, onClose }: Options = {}) {
  const setState = useReceiverStore((s) => s.setState);
  const eventSource = useRef<EventSource>();

  const connect = (secret: string) => {
    setState("connecting");

    const abort = new AbortController();
    const es = new EventSource(`//${ES_HOST}/join?s=${secret.toUpperCase()}`);

    es.addEventListener(
      "open",
      (e) => {
        setState("ready");
        onOpen?.(e);
      },
      { signal: abort.signal }
    );

    es.addEventListener(
      "error",
      (e) => {
        setState("reconnecting");
        onError?.(e);
      },
      { signal: abort.signal }
    );

    es.addEventListener(
      "message",
      (e) => {
        const host = new URL(e.origin).host;
        if (host !== ES_HOST) return;

        try {
          const data = JSON.parse(e.data);
          console.log("SSE event", data);

          if (data.id === undefined)
            throw new Error("Malformed: `id` is missing");
          if (data.name === undefined)
            throw new Error("Malformed: `name` is missing");
          if (data.size === undefined)
            throw new Error("Malformed: `size` is missing");
          if (data.type === undefined)
            throw new Error("Malformed: `type` is missing");

          onMessage?.({
            code: MessageCode.Metadata,
            id: data.id,
            name: data.name,
            size: data.size,
            type: data.type,
          });
        } catch (e) {}
      },
      { signal: abort.signal }
    );

    eventSource.current = es;

    return () => {
      abort.abort();
      es.close();
    };
  };

  return {
    connect,
  };
}
