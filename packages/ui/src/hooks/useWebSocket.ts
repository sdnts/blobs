import type { BlobId, Message } from "@blobs/protocol";
import { MessageCode, deserialize, serialize } from "@blobs/protocol";
import { useWebSocket as usePartySocket } from "partysocket/react";
import { useEffect, useRef } from "react";
import { formatSize, useStore } from "../store";
import { toast } from "sonner";

const WS_SCHEME = import.meta.env.DEV ? "ws://" : "wss://";
const WS_HOST = import.meta.env.PUBLIC_API_HOST;

export function useWebSocket(token: string) {
  const [state, setState, uploads, uploaded] = useStore((s) => [
    s.state,
    s.setState,
    s.uploads,
    s.uploaded,
  ]);

  const streams = useRef<
    Record<BlobId["id"], ReadableStreamDefaultReader<Uint8Array>>
  >({});

  const ws = usePartySocket(
    `${WS_SCHEME}${WS_HOST}/tunnel?t=${encodeURIComponent(token)}`,
    undefined,
    {
      maxRetries: 10,
      onOpen: () => {
        if (state === "disconnected") setState("ready");
      },
      onClose: () => setState("disconnected"),
      onError: () => setState("fatal"),
      onMessage: async (e) => {
        if (!(e.data instanceof Blob)) return;

        const data = await e.data.arrayBuffer();
        const message = deserialize(new Uint8Array(data));
        if (message.err) return;

        switch (message.val.code) {
          case MessageCode.PeerConnected:
            return setState("ready");

          case MessageCode.PeerDisconnected:
            return setState("waiting");

          case MessageCode.Metadata: {
            toast.loading(
              `Downloading ${message.val.name} (${formatSize(
                message.val.size
              )})`,
              { description: "Watch your downloads", duration: 10_000 }
            );

            const params = new URLSearchParams();
            params.set("t", token);
            params.set("o", message.val.id.owner);
            params.set("i", message.val.id.id);
            window.location.assign(
              `//${
                import.meta.env.PUBLIC_API_HOST
              }/download?${params.toString()}`
            );
          }

          case MessageCode.DataRequest: {
            const { id: blobId } = message.val.id;

            const blob = uploads.find((u) => u.id === blobId);
            if (!blob) return;

            let stream = streams.current[blobId];
            if (!stream) {
              stream = streams.current[blobId] = blob.handle
                .stream()
                .pipeThrough<Uint8Array>(new CompressionStream("gzip"))
                .getReader();
            }

            // DO has a 1MiB incoming message limit, so we'll send 1MB at a time
            // This allows us ample space for any extra bytes our serialization
            // might add.
            const CHUNK_SIZE = 100_000_000;

            const { done, value } = await stream.read();
            if (done) {
              uploaded(blobId);
              ws.send(
                serialize({
                  code: MessageCode.DataChunk,
                  id: message.val.id,
                  offset: 0,
                  bytes: new Uint8Array(0),
                })
              );
              ws.send(
                serialize({
                  code: MessageCode.DataChunkEnd,
                  id: message.val.id,
                })
              );
              return;
            }

            const parts = Math.ceil(value.byteLength / CHUNK_SIZE);
            for (let p = 0; p < parts; p++) {
              const offset = p * CHUNK_SIZE;
              const bytes = value.slice(offset, offset + CHUNK_SIZE);
              ws.send(
                serialize({
                  code: MessageCode.DataChunk,
                  id: message.val.id,
                  offset,
                  bytes,
                })
              );
            }

            ws.send(
              serialize({
                code: MessageCode.DataChunkEnd,
                id: message.val.id,
              })
            );
          }
        }
      },
    }
  );

  useEffect(() => {
    if (!ws.OPEN) return;

    const keepalive = setInterval(
      () => ws.send(serialize({ code: MessageCode.Keepalive })),
      10_000
    );

    return () => clearInterval(keepalive);
  }, [ws.readyState]);

  return {
    send: (message: Message) => ws.send(serialize(message)),
  };
}
