import type { BlobId } from "@blobs/protocol";
import { toast } from "sonner";
import { shallow } from "zustand/shallow";
import { createWithEqualityFn } from "zustand/traditional";

type TunnelState =
  | "idle" // No WebSocket activity
  | "connecting" // This peer is connecting
  | "waiting" // Waiting on the other peer
  | "ready" // Both peers are connected
  | "reconnecting" // This peer is reconnecting
  | "disconnected" // This peer is disconnected
  | "fatal"; // This peer encountered an unrecoverable error

let idCounter = 0;

type Upload = { id: BlobId["id"]; handle: File };

type Store = {
  state: TunnelState;
  setState: (s: TunnelState) => void;

  uploads: Upload[];
  upload: (f: File) => Upload;
  uploaded: (id: Upload["id"]) => void;
};

export const useStore = createWithEqualityFn<Store>()(
  (set) => ({
    state: "idle",
    setState: (state) => {
      set({ state });

      if (state === "ready") toast.success("Ready");
      if (state === "waiting") toast("Join now");
      if (state === "disconnected") toast.error("Disconnected, reconnecting");
    },

    uploads: [],
    upload: (f) => {
      const upload = { id: `${idCounter++}`, handle: f };
      set((store) => ({ uploads: store.uploads.concat(upload) }));
      return upload;
    },
    uploaded: (id) =>
      set((store) => ({ uploads: store.uploads.filter((u) => u.id !== id) })),
  }),
  shallow
);

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
