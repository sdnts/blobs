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
import { CheckCircle, WarningCircle, X } from "@phosphor-icons/react";

const WS_SCHEME = import.meta.env.DEV ? "ws://" : "wss://";
const API_HOST = import.meta.env.DEV ? "localhost:8787" : "api.blob.city";

type Store = {
  token?: string;
  secret?: string;
  session?: ReconnectingWebSocket;
  tunnels: Record<string, { name: string; size: number; progress: number }>;

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
          icon: <CheckCircle weight="duotone" size={16} />,
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
          icon: <WarningCircle weight="duotone" size={16} />,
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
        `${WS_SCHEME}${API_HOST}/session/connect?t=${encodeURIComponent(token)}`
      );

      return new Promise((resolve, reject) => {
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
        ws.onclose = (e) => {
          console.log("Disconnected", e.reason);
          clearInterval(keepalive);
          reject();
        };
        ws.onerror = (e) => {
          console.log("Disconnected (error)", e.error);
          clearInterval(keepalive);
          reject();
        };

        ws.onmessage = (e) => {
          const message = deserializeSessionMessage(e.data);
          if (message.err) return;

          if (message.val.code === SessionMessageCode.PeerConnected) {
            toast.dismiss();
            toast.success("Ready", {
              icon: <CheckCircle weight="duotone" size={16} />,
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

        toast.success("Ready", {
          icon: <CheckCircle weight="duotone" size={16} />,
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
          icon: <WarningCircle weight="duotone" size={16} />,
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

      const session = new ReconnectingWebSocket(
        `${WS_SCHEME}${API_HOST}/session/connect?t=${encodeURIComponent(
          token
        )}`,
        undefined
      );
      const listeners = new AbortController();
      set({ session });

      const keepalive = setInterval(
        () =>
          session.send(
            serializeSessionMessage({ code: SessionMessageCode.Keepalive })
          ),
        10_000
      );

      session.addEventListener(
        "open",
        () => {
          console.log("Connected");
        },
        { signal: listeners.signal }
      );
      session.addEventListener(
        "close",
        () => {
          console.log("Disconnected");
        },
        { signal: listeners.signal }
      );
      session.addEventListener(
        "error",
        () => {
          console.log("Disconnected (error)");
          listeners.abort();
        },
        { signal: listeners.signal }
      );

      session.addEventListener(
        "message",
        (e) => {
          const message = deserializeSessionMessage(e.data);
          if (message.err) return;
          if (message.val.code !== SessionMessageCode.TunnelUploaderReady)
            return;

          // If a tunnel with this ID already exists, it means we've already
          // initiated a download for it
          if (get().tunnels[message.val.tunnelId]) return;

          console.log("Downloading", message.val);
          download(message.val);
        },
        { signal: listeners.signal }
      );

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
      const listeners = new AbortController();

      tunnel.addEventListener(
        "open",
        () => {
          console.log("Will upload to", tunnelId, {
            name: file.name,
            size: file.size,
            type: file.type || "application/octet-stream",
          });

          set((s) => {
            s.tunnels[tunnelId] = {
              name: file.name,
              size: file.size,
              progress: 0,
            };
          });

          session.send(
            serializeSessionMessage({
              code: SessionMessageCode.TunnelUploaderReady,
              tunnelId,
              name: file.name,
              size: file.size,
              type: file.type || "application/octet-stream",
            })
          );
        },
        { signal: listeners.signal }
      );

      tunnel.addEventListener(
        "close",
        () => {
          console.log("Tunnel closed");
          set((s) => {
            delete s.tunnels[tunnelId];
          });

          listeners.abort();
        },
        { signal: listeners.signal }
      );

      tunnel.addEventListener(
        "error",
        () => {
          console.log("Tunnel closed (error)");
          set((s) => {
            delete s.tunnels[tunnelId];
          });

          listeners.abort();
        },
        { signal: listeners.signal }
      );

      const stream = file
        .stream()
        .pipeThrough<Uint8Array>(new CompressionStream("gzip"))
        .getReader();

      tunnel.addEventListener(
        "message",
        async () => {
          console.debug("Chunk requested");
          // DO has a 1MiB limit for WebSocket message sizes. We'll play it safe
          // by assuming it is 1MB
          const MAX_WS_MESSAGE_SIZE = 1_000_000;
          // The size of a chunk received via a `file.read()` is browser
          // implementation-dependent, but I've noticed that this number is 16KiB
          // for Chromium and Firefox.
          const HEURISTIC_CHUNK_SIZE = 16384; // 16KiB

          // The browser generally reads files in 16KiB chunks, but DO messages
          // can be 1MiB in size. Instead of sending over one chunk at a time,
          // let's try and pack a single WebSocket message with multiple chunks
          // (this will help massively with transfer speeds).
          // We'll read from the file stream greedily, appending to a single
          // message until we run over the DO size limit.

          // Allocate a buffer upfront since we know the upper limit of a message's size
          const msgBuffer = new Uint8Array(MAX_WS_MESSAGE_SIZE);
          let msgByteLength = 0; // How mmany bytes have we actually filled up
          let streamEnded = false;

          // console.debug(
          //   { name: file.name },
          //   `Initialized message buffer with ${msgByteLength} bytes`
          // );

          // This loop reads from the File stream and appends to the WS message
          // buffer until it can't no mo'
          while (true) {
            // If we expect the next chunk size to overflow the WS message buffer,
            // stop reading. This is all heuristic so not 100% accurate, but it
            // saves us from having to deal with overflow bytes
            if (msgByteLength + HEURISTIC_CHUNK_SIZE > MAX_WS_MESSAGE_SIZE) {
              break;
            }

            const { done, value: chunk } = await stream.read();
            if (done) {
              streamEnded = true;
              break;
            }

            console.debug(
              { name: file.name },
              `Appending ${chunk.byteLength} bytes to message buffer`
            );
            msgBuffer.set(chunk, msgByteLength);
            msgByteLength += chunk.byteLength;
          }

          console.debug(
            { name: file.name },
            `Sending message of size ${msgByteLength}`
          );

          tunnel.send(msgBuffer.slice(0, msgByteLength));
          set((s) => {
            s.tunnels[tunnelId].progress += msgByteLength;
          });

          if (streamEnded) {
            console.log(
              { name: file.name, size: file.size },
              "Upload finished"
            );

            listeners.abort();
            tunnel.close(1000);
            set((s) => {
              s.tunnels[tunnelId].progress = file.size;
            });
            setTimeout(
              () =>
                set((s) => {
                  delete s.tunnels[tunnelId];
                }),
              5000
            );
          }
        },
        { signal: listeners.signal }
      );
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
