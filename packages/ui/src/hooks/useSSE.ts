import { MessageCode, type Message } from "@blobs/protocol";
import { useEffect, useRef } from "react";

const ES_HOST = import.meta.env.PUBLIC_API_HOST;

type Params = {
  onOpen?: (e: Event) => void;
  onMessage?: (e: Message) => void;
  onError?: (e: Event) => void;
  onClose?: (e: CloseEvent) => void;
};

export function useSSE({ onOpen, onMessage, onError, onClose }: Params = {}) {
  const eventSource = useRef<EventSource>();

  useEffect(() => {
    const abort = new AbortController();
    const es = new EventSource(`//${ES_HOST}/000000/join`);

    es.addEventListener("open", (e) => onOpen?.(e), { signal: abort.signal });
    es.addEventListener("error", (e) => onError?.(e), { signal: abort.signal });

    es.addEventListener(
      "message",
      (e) => {
        const host = new URL(e.origin).host;
        if (host !== ES_HOST) return;

        try {
          const data = JSON.parse(e.data);

          if (!data.name) throw new Error("Malformed: `name` is missing");
          if (!data.size) throw new Error("Malformed: `size` is missing");

          onMessage?.({
            code: MessageCode.Metadata,
            name: data.name,
            size: data.size,
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
  }, []);
}
