import { CloudArrowUp } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";

export const TunnelPage = () => {
  const { restore, connect, tunnel, upload } = useStore((s) => ({
    restore: s.restore,
    connect: s.connect,
    tunnel: s.tunnel,
    upload: s.upload,
  }));

  useEffect(() => {
    restore();
    const keepalive = connect();
    return () => keepalive && clearInterval(keepalive);
  }, []);

  const fileInput = useRef<HTMLInputElement>(null);
  const [dropping, setDropping] = useState(false);
  const onDrop = (files: File[]) => {
    // TODO: Should I create a thread per upload?
    files.map((f) => tunnel().then((tunnelId) => upload(tunnelId, f)));
  };

  useEffect(() => {
    const listener = new AbortController();
    document.addEventListener(
      "dragenter",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDropping(true);
      },
      { capture: true, signal: listener.signal }
    );
    document.addEventListener(
      "dragover",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDropping(true);
      },
      { capture: true, signal: listener.signal }
    );
    document.addEventListener(
      "dragleave",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDropping(false);
      },
      { capture: true, signal: listener.signal }
    );

    document.addEventListener(
      "drop",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDropping(false);
        onDrop(Array.from(e.dataTransfer?.files ?? []));
      },
      { capture: true, signal: listener.signal }
    );

    return () => listener.abort();
  }, []);

  return (
    <main className="flex-1 flex flex-col items-center">
      <section id="files" className="flex flex-col items-center">
        {/* {uploads.length > 0 && ( */}
        {/*   <ul className={clsx("mt-24 text-2xl", "grid grid-cols-2 gap-4")}> */}
        {/*     {uploads.map((u) => ( */}
        {/*       <Fragment key={u.handle.name}> */}
        {/*         <li className="text-right">{u.handle.name}</li> */}
        {/*         <span className="text-gray">{formatSize(u.handle.size)}</span> */}
        {/*       </Fragment> */}
        {/*     ))} */}
        {/*   </ul> */}
        {/* )} */}

        <div className="mt-36 flex flex-col items-center gap-3 text-2xl text-gray">
          <CloudArrowUp weight="bold" size={24} />
          {dropping && (
            <div
              className={
                "fixed inset-4 rounded-md border-dashed border-8 border-black"
              }
            />
          )}

          <button
            data-testid="upload"
            onClick={() => fileInput.current?.click()}
          >
            Drop Files
          </button>
          <input
            ref={fileInput}
            type="file"
            className="hidden"
            onChange={(e) => onDrop(Array.from(e.currentTarget.files ?? []))}
          />
        </div>
      </section>
    </main>
  );
};
