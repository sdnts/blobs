import { MessageCode } from "@blobs/protocol";
import { CloudArrowUp } from "@phosphor-icons/react";
import clsx from "clsx";
import { Fragment, useEffect, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import { useWebSocket } from "../hooks/useWebSocket";
import { formatSize, useStore } from "../store";

export const Tunnel = () => {
  const peerId = useStore((s) => s.peerId);
  const setPeerId = useStore((s) => s.setPeerId);

  const state = useStore((s) => s.state);

  const uploads = useStore((store) => store.uploads);
  const upload = useStore((store) => store.upload);

  const secret = useMemo(() => sessionStorage.getItem("secret"), []);
  useEffect(() => {
    const id = sessionStorage.getItem("peerId");
    if (!id) location.pathname = "/";
    setPeerId(id!);
  }, []);

  const ws = useWebSocket();

  const { open, getRootProps, getInputProps, isDragActive } = useDropzone({
    noClick: true,
    noKeyboard: true,
    preventDropOnDocument: true,
    onDrop: (f) => {
      f.forEach((f) => {
        const uploadId = upload(f);
        ws.send({
          code: MessageCode.Metadata,
          id: { owner: peerId!, id: uploadId.id },
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
              {secret}
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
