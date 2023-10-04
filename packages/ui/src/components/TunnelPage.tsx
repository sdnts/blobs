import { CloudArrowUp } from "@phosphor-icons/react";
import { useEffect } from "react";
import { useDropzone } from "react-dropzone";
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

  const { open, getRootProps, getInputProps, isDragActive } = useDropzone({
    noClick: true,
    noKeyboard: true,
    preventDropOnDocument: true,
    onDrop: async (files) => {
      // TODO: Should I create a thread per upload?
      files.map((f) => tunnel().then((tunnelId) => upload(tunnelId, f)));
    },
  });

  return (
    <main className="flex-1 flex flex-col items-center" {...getRootProps()}>
      <input {...getInputProps()} />

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
