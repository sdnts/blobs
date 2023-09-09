import { MessageCode } from "@blobs/protocol";
import { CloudArrowUp } from "@phosphor-icons/react";
import clsx from "clsx";
import { Fragment, Suspense } from "react";
import { useDropzone } from "react-dropzone";
import { useWebSocket } from "../hooks/useWebSocket";
import { formatSize, useStore } from "../store";
import { ErrorBoundary } from "./ErrorBoundary";
import { suspend } from "suspend-react";
import { toast } from "sonner";

export const Tunnel = () => {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Fragment />}>
        <Peer />
      </Suspense>
    </ErrorBoundary>
  );
};

type Session = {
  peerId: string;
  token: string;
  secret?: string;
};

const Peer = () => {
  const [state, uploads, upload] = useStore((s) => [
    s.state,
    s.uploads,
    s.upload,
  ]);

  const session = suspend(
    () =>
      new Promise<Session>((resolve, reject) => {
        const peerId = sessionStorage.getItem("peerId");
        const token = sessionStorage.getItem("token");
        const secret = sessionStorage.getItem("secret") ?? undefined;

        if (!peerId || !token) {
          toast.error("An unrecoverable error has occurred", {
            duration: 20_000,
          });
          if (!peerId) return reject("Missing peerId in session");
          if (!token) return reject("Missing token in session");
        }

        return resolve({ peerId, token, secret });
      }),
    []
  );

  const ws = useWebSocket(session.peerId, session.token);

  const { open, getRootProps, getInputProps, isDragActive } = useDropzone({
    noClick: true,
    noKeyboard: true,
    preventDropOnDocument: true,
    onDrop: (f) => {
      f.forEach((f) => {
        const uploadId = upload(f);
        ws.send({
          code: MessageCode.Metadata,
          id: { owner: session.peerId, id: uploadId.id },
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
      <section
        id="secret"
        className={clsx("flex flex-col items-center gap-4", "mt-36")}
      >
        {state !== "ready" && (
          <>
            <span className="text-gray text-2xl tracking-normal">
              Use this secret to receive
            </span>
            <span id="secret" className="font-bold text-9xl tracking-widest">
              {session.secret}
            </span>
          </>
        )}
      </section>

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
            <button onClick={open}>Drop Files</button>
          )}
        </div>
      </section>
    </main>
  );
};
