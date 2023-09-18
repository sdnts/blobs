import { MessageCode, type PeerId } from "@blobs/protocol";
import { CloudArrowUp } from "@phosphor-icons/react";
import clsx from "clsx";
import { Fragment, Suspense } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { suspend } from "suspend-react";
import { useWebSocket } from "../hooks/useWebSocket";
import { formatSize, useStore } from "../store";
import { ErrorBoundary } from "./ErrorBoundary";

export const TunnelPage = () => {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Fragment />}>
        <Tunnel />
      </Suspense>
    </ErrorBoundary>
  );
};

type Session = {
  peerId: PeerId;
  token: string;
};

const Tunnel = () => {
  const session = suspend(
    () =>
      new Promise<Session>((resolve, reject) => {
        const peerId = sessionStorage.getItem("peerId");
        const token = sessionStorage.getItem("token");

        if (!peerId || !token) {
          toast.error("An unrecoverable error has occurred", {
            duration: 10_000,
          });
          if (!peerId) return reject("Missing peerId in session");
          if (!token) return reject("Missing token in session");
        }

        if (peerId !== "1" && peerId !== "2")
          return reject("Invalid peerId in session");

        return resolve({ peerId, token });
      }),
    []
  );

  const [uploads, upload] = useStore((s) => [s.uploads, s.upload]);

  const ws = useWebSocket(session.token);
  const { open, getRootProps, getInputProps, isDragActive } = useDropzone({
    noClick: true,
    noKeyboard: true,
    preventDropOnDocument: true,
    onDrop: (f) => {
      f.forEach((f) => {
        const u = upload(f);
        ws.send({
          code: MessageCode.Metadata,
          id: { owner: session.peerId, id: u.id },
          name: f.name,
          size: f.size,
          type: f.type || "application/octet-stream",
        });
      });
    },
  });

  return (
    <main className="flex-1 flex flex-col items-center" {...getRootProps()}>
      <input {...getInputProps()} />

      <section id="files" className="flex flex-col items-center">
        {uploads.length > 0 && (
          <ul className={clsx("mt-24 text-2xl", "grid grid-cols-2 gap-4")}>
            {uploads.map((u) => (
              <Fragment key={u.handle.name}>
                <li className="text-right">{u.handle.name}</li>
                <span className="text-gray">{formatSize(u.handle.size)}</span>
              </Fragment>
            ))}
          </ul>
        )}

        <div className="mt-36 flex flex-col items-center gap-3 text-2xl text-gray">
          <CloudArrowUp weight="bold" size={24} />
          {isDragActive ? (
            <div
              className={
                "fixed inset-4 rounded-md border-dashed border-8 border-black"
              }
            />
          ) : (
            <button data-testid="upload" onClick={open}>
              Drop Files
            </button>
          )}
        </div>
      </section>
    </main>
  );
};
