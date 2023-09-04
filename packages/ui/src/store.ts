import type { BlobId } from "@blobs/protocol";
import { create } from "zustand";

type TunnelState =
  | "idle" // No WebSocket activity
  | "connecting" // This peer is connecting
  | "waiting" // Waiting on t.he other peer
  | "ready" // Both peers are connected
  | "reconnecting" // This peer is reconnecting
  | "disconnected"; // This peer is disconnected

let idCounter = 0;

type Upload = { id: BlobId["id"]; handle: File };

type Store = {
  peerId: string | null;
  setPeerId: (i: string) => void;

  state: TunnelState;
  setState: (s: TunnelState) => void;

  uploads: Upload[];
  upload: (f: File) => Upload;
  uploaded: (id: Upload["id"]) => void;
};

export const useStore = create<Store>()((set) => ({
  peerId: null,
  setPeerId: (peerId) => set({ peerId }),

  state: "idle",
  setState: (state) => set({ state }),

  uploads: [],
  upload: (f) => {
    const upload = { id: `${idCounter++}`, handle: f };
    set((store) => ({ uploads: store.uploads.concat(upload) }));
    return upload;
  },
  uploaded: (id) =>
    set((store) => ({ uploads: store.uploads.filter((u) => u.id !== id) })),
}));

export const formatSize = (size: number): string => {
  // The font I'm using does not have lowercase letters lol, so avoid confusion
  // and just use Mb instead of MiB
  if (size < 1_000) return `${size} B`;
  if (size < 1_000_000) return `${(size / 1_000).toFixed(2)} KB`;
  if (size < 1_000_000_000) return `${(size / 1_000_000).toFixed(2)} MB`;
  if (size < 1_000_000_000_000)
    return `${(size / 1_000_000_000).toFixed(2)} GB`;
  else return `${(size / 1_000_000_000_000).toFixed(2)} TB`;
};
