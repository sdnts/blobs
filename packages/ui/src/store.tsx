import {
  SessionMessageCode,
  deserializeSessionMessage,
  serializeSessionMessage,
} from "@blobs/protocol";
import ReconnectingWebSocket from "partysocket/ws";
import { toast } from "sonner";
import { shallow } from "zustand/shallow";
import { useStoreWithEqualityFn } from "zustand/traditional";
import { createStore } from "zustand/vanilla";
import { immer } from "zustand/middleware/immer";

const WS_SCHEME = import.meta.env.DEV ? "ws://" : "wss://";
const API_HOST = import.meta.env.DEV ? "localhost:8787" : "api.blob.city";

type Store = {
  token?: string;
  secret?: string;
  session?: ReconnectingWebSocket;
  tunnels: Record<string, { name: string; size: number; uploaded: number }>;

  restore: () => void;
  create: () => Promise<void>;
  wait: () => Promise<void>;
  join: (secret: string) => Promise<void>;
  connect: () => NodeJS.Timer | undefined;
  tunnel: () => Promise<string>;
  upload: (tunnelId: string, file: File) => Promise<void>;
  download: (file: {
    tunnelId: string;
    name: string;
    size: number;
    type: string;
  }) => Promise<void>;
};

export const store = createStore(
  immer<Store>((set, get) => ({
    token: undefined,
    secret: undefined,
    session: undefined,
    tunnels: {},

    restore: () =>
      set({
        token: sessionStorage.getItem("token") ?? undefined,
        secret: sessionStorage.getItem("secret") ?? undefined,
      }),

    create: async () => {
      const t = toast.loading("Creating tunnel");

      try {
        set({ token: undefined, secret: undefined });
        sessionStorage.clear();

        const res = await fetch(`//${API_HOST}/session/create`, {
          method: "PUT",
        });

        if (res.status !== 200) throw new Error();

        const { token, secret } = await res.json();
        if (!token || !secret) throw new Error();

        toast.success("Tunnel created", {
          id: t,
          duration: Infinity,
          description: (
            <span data-testid="toast-success">
              Use the secret <strong>{secret}</strong> to join this tunnel
            </span>
          ),
        });

        set({ token, secret });
        sessionStorage.setItem("secret", secret);
        sessionStorage.setItem("token", token);
      } catch (e) {
        toast.error("Could not create tunnel", {
          id: t,
          duration: 10_000,
          description: (
            <span>
              Please try again in a bit, or{" "}
              <a
                href="https://github.com/sdnts/blobs/issues/new"
                className="underline"
                target="_blank"
                rel="noreferrer"
              >
                report an issue
              </a>
            </span>
          ),
        });

        return Promise.reject();
      }
    },

    wait: async () => {
      const { token } = get();

      if (!token) {
        toast.error("An unrecoverable error has occurred", {
          description: "No token in state",
          duration: 10_000,
        });
        return;
      }

      const ws = new ReconnectingWebSocket(
        `${WS_SCHEME}${API_HOST}/session/connect?t=${encodeURIComponent(
          token
        )}`,
        undefined
      );

      return new Promise((resolve) => {
        let keepalive: NodeJS.Timer;

        ws.onopen = () => {
          console.log("Connected");
          keepalive = setInterval(
            () =>
              ws.send(
                serializeSessionMessage({ code: SessionMessageCode.Keepalive })
              ),
            10_000
          );
        };
        ws.onclose = () => {
          console.log("Disconnected");
          clearInterval(keepalive);
        };
        ws.onerror = () => {
          console.log("Disconnected (error)");
          clearInterval(keepalive);
        };

        ws.onmessage = (e) => {
          const message = deserializeSessionMessage(e.data);
          if (message.err) return;

          if (message.val.code === SessionMessageCode.PeerConnected) {
            toast.dismiss();
            toast("Ready", {
              description: "Drop files here to stream them to the other end!",
            });

            clearInterval(keepalive);
            resolve();
          }
        };
      });
    },

    join: async (secret) => {
      try {
        set({ token: undefined, secret });
        sessionStorage.clear();

        const res = await fetch(`//${API_HOST}/session/join?s=${secret}`, {
          method: "PUT",
        });

        if (res.status !== 200) throw new Error();

        toast("Ready", {
          description: "Drop files here to stream them to the other end!",
        });

        const { token } = await res.json();
        if (!token) throw new Error();

        set({ token });
        sessionStorage.setItem("secret", secret);
        sessionStorage.setItem("token", token);
      } catch (e) {
        toast.error("Could not join tunnel, is your secret correct?", {
          duration: 10_000,
          description: (
            <a
              href="https://github.com/sdnts/blobs/issues/new"
              className="underline"
              target="_blank"
              rel="noreferrer"
            >
              Report an issue
            </a>
          ),
        });

        return Promise.reject();
      }
    },

    connect: () => {
      const { token, download } = get();

      if (!token) {
        toast.error("An unrecoverable error has occurred", {
          description: "No token in state",
          duration: 10_000,
        });
        return;
      }

      const ws = new ReconnectingWebSocket(
        `${WS_SCHEME}${API_HOST}/session/connect?t=${encodeURIComponent(
          token
        )}`,
        undefined
      );
      set({ session: ws });

      const keepalive = setInterval(
        () =>
          ws.send(
            serializeSessionMessage({ code: SessionMessageCode.Keepalive })
          ),
        10_000
      );

      ws.onopen = () => {
        console.log("Connected");
      };
      ws.onclose = () => {
        console.log("Disconnected");
      };
      ws.onerror = () => {};
      ws.onmessage = (e) => {
        const message = deserializeSessionMessage(e.data);
        if (message.err) return;

        if (message.val.code !== SessionMessageCode.TunnelReady) return;

        const { tunnels } = get();
        if (tunnels[message.val.tunnelId]) return;

        console.log("Downloading", message.val);
        download(message.val);
      };

      return keepalive;
    },

    tunnel: async () =>
      new Promise<string>((resolve, reject) => {
        const { session } = get();
        if (!session) {
          toast.error("An unrecoverable error has occurred", {
            description: "No session in state",
            duration: 10_000,
          });
          return reject();
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => {
          controller.abort();
          toast.error("An unrecoverable error has occurred", {
            description: "Tunnel creation timeout",
            duration: 10_000,
          });
          reject();
        }, 5000);

        session.addEventListener(
          "message",
          (e) => {
            const message = deserializeSessionMessage(e.data);
            if (message.err) return;
            if (message.val.code !== SessionMessageCode.TunnelCreated) return;

            controller.abort();
            clearTimeout(timeout);
            return resolve(message.val.tunnelId);
          },
          { signal: controller.signal }
        );

        session.send(
          serializeSessionMessage({ code: SessionMessageCode.TunnelCreate })
        );
      }),

    upload: async (tunnelId, file) => {
      const { token, session } = get();
      if (!token) {
        toast.error("An unrecoverable error has occurred", {
          description: "No token in state",
          duration: 10_000,
        });
        return;
      }
      if (!session) {
        toast.error("An unrecoverable error has occurred", {
          description: "No session in state",
          duration: 10_000,
        });
        return;
      }

      const tunnel = new WebSocket(
        `${WS_SCHEME}${API_HOST}/session/tunnel/${tunnelId}?t=${encodeURIComponent(
          token
        )}`
      );

      tunnel.onopen = async () => {
        console.log("Uploading to", tunnelId, {
          name: file.name,
          size: file.size,
          type: file.type || "application/octet-stream",
        });

        set((s) => {
          s.tunnels[tunnelId] = {
            name: file.name,
            size: file.size,
            uploaded: 0,
          };
        });

        session.send(
          serializeSessionMessage({
            code: SessionMessageCode.TunnelReady,
            tunnelId,
            name: file.name,
            size: file.size,
            type: file.type || "application/octet-stream",
          })
        );
      };

      tunnel.onclose = () => {};
      tunnel.onerror = () => {};

      const stream = file
        .stream()
        .pipeThrough<Uint8Array>(new CompressionStream("gzip"))
        .getReader();

      tunnel.onmessage = async () => {
        const { done, value: chunk } = await stream.read();
        if (done) {
          console.log({ name: file.name, size: file.size }, "Upload finished");
          set((s) => {
            s.tunnels[tunnelId].uploaded = s.tunnels[tunnelId].size;
          });

          setTimeout(
            () =>
              set((s) => {
                delete s.tunnels[tunnelId];
              }),
            5000
          );
          tunnel.close(1000);
          return;
        }

        // DO has a 1MiB incoming message limit, so we'll send 1MB at a time
        // This allows us ample space for any extra bytes our serialization
        // might add.
        const BLOCK_SIZE = 100_000_000;

        const numBlocks = Math.ceil(chunk.byteLength / BLOCK_SIZE);
        for (let i = 0; i < numBlocks; i++) {
          const offset = i * BLOCK_SIZE;
          const block = chunk.slice(offset, offset + BLOCK_SIZE);
          console.debug(
            { name: file.name },
            `Uploading block ${i + 1}/${numBlocks} with size ${
              block.byteLength
            }`
          );
          tunnel.send(block);
          set((s) => {
            s.tunnels[tunnelId].uploaded += block.byteLength;
          });
        }

        // Mark the chunk boundary
        tunnel.send(new Uint8Array(0));
      };
    },

    download: async ({ tunnelId, name, size, type }) => {
      const { token } = get();
      if (!token) {
        toast.error("An unrecoverable error has occurred", {
          description: "No token in state",
          duration: 10_000,
        });
        return;
      }

      window.location.assign(
        `//${API_HOST}/session/tunnel/${tunnelId}?t=${encodeURIComponent(
          token
        )}&n=${encodeURIComponent(name)}&s=${size}&ct=${encodeURIComponent(
          type
        )}`
      );
    },
  }))
);

export function useStore<T>(selector: (state: Store) => T): T {
  return useStoreWithEqualityFn(store, selector, shallow);
}
