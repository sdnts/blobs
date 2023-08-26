import type { Message } from "@blobs/protocol";
import { create } from "zustand";

type StreamState =
  | "idle"
  | "connecting"
  | "waiting"
  | "ready"
  | "reconnecting"
  | "disconnected";

type SenderStore = {
  state: StreamState;
  setState: (s: StreamState) => void;

  secret: string | null;
  setSecret: (s: string) => void;

  files: File[];
  addFile: (f: File) => void;
  removeFile: (idx: number) => void;

  messageBuffer: Message[];
  bufferMessage: (m: Message) => void;
  emptyMessageBuffer: () => void;
};

export const useSenderStore = create<SenderStore>()((set) => ({
  state: "idle",
  setState: (s) => set({ state: s }),

  secret: null,
  setSecret: (s) => set({ secret: s }),

  files: [],
  addFile: (f: File) => set((store) => ({ files: store.files.concat(f) })),
  removeFile: (idx: number) =>
    set((store) => ({ files: store.files.splice(idx, 1) })),

  messageBuffer: [],
  bufferMessage: (m: Message) =>
    set((store) => ({ messageBuffer: store.messageBuffer.concat(m) })),
  emptyMessageBuffer: () => set({ messageBuffer: [] }),
}));

type ReceiverStore = {
  state: StreamState;
  setState: (s: StreamState) => void;

  secret: string;
  setSecret: (s: string) => void;
};

export const useReceiverStore = create<ReceiverStore>()((set) => ({
  state: "waiting",
  setState: (s) => set({ state: s }),

  secret: "",
  setSecret: (s) => set({ secret: s }),
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
