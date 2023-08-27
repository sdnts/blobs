import type { BlobMetadata, Message } from "@blobs/protocol";
import { create } from "zustand";

type StreamState =
  | "idle"
  | "connecting"
  | "waiting"
  | "ready"
  | "reconnecting"
  | "disconnected";

let idCounter = 0;

type SenderStore = {
  state: StreamState;
  setState: (s: StreamState) => void;

  secret: string | null;
  setSecret: (s: string) => void;

  blobs: Array<BlobMetadata & { handle: File }>;
  addBlob: (b: File) => BlobMetadata;
  removeBlob: (idx: number) => void;

  messageQueue: Message[];
  queueMessage: (m: Message) => void;
  emptyMessageQueue: () => void;
};

export const useSenderStore = create<SenderStore>()((set) => ({
  state: "idle",
  setState: (s) => set({ state: s }),

  secret: null,
  setSecret: (s) => set({ secret: s }),

  blobs: [],
  addBlob: (b: File) => {
    const file = {
      id: idCounter++,
      name: b.name,
      size: b.size,
      type: b.type || "application/octet-stream",
      handle: b,
    };

    set((store) => ({ blobs: [...store.blobs, file] }));
    return file;
  },
  removeBlob: (idx: number) =>
    set((store) => ({ blobs: store.blobs.splice(idx, 1) })),

  messageQueue: [],
  queueMessage: (m: Message) =>
    set((store) => ({ messageQueue: store.messageQueue.concat(m) })),
  emptyMessageQueue: () => set({ messageQueue: [] }),
}));

type ReceiverStore = {
  state: StreamState;
  setState: (s: StreamState) => void;

  secret: string;
  setSecret: (s: string) => void;

  blobs: BlobMetadata[];
  addBlob: (b: BlobMetadata) => void;
};

export const useReceiverStore = create<ReceiverStore>()((set) => ({
  state: "waiting",
  setState: (s) => set({ state: s }),

  secret: "",
  setSecret: (s) => set({ secret: s }),

  blobs: [],
  addBlob: (blob: BlobMetadata) =>
    set((store) => {
      if (store.blobs.find((f) => f.id === blob.id)) return {}; // Dedupe
      return { blobs: store.blobs.concat(blob) };
    }),
}));

export const formatSize = (size: number): string => {
  // The font I'm using does not have lowercase letters lol, so avoid confusion
  // and just use Mb instead of MiB
  if (size < 1000) return `${size} B`;
  if (size < 1_000_000) return `${(size / 1000).toFixed(2)} KB`;
  if (size < 1_000_000_000) return `${(size / 1_000_1000).toFixed(2)} MB`;
  if (size < 1_000_000_000_000)
    return `${(size / 1_000_000_000).toFixed(2)} GB`;
  else return `${(size / 1_000_000_000_000).toFixed(2)} TB`;
};
