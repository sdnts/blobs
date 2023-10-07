import { Check, CloudArrowUp } from "@phosphor-icons/react";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import { Progress } from "./Progress";

export const TunnelPage = () => {
  const { tunnelIds, restore, connect, tunnel, upload } = useStore((s) => ({
    tunnelIds: Object.keys(s.tunnels),
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
    console.log("Files dropped", files);
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
      {dropping && (
        <div
          className={
            "fixed inset-4 rounded-md border-dashed border-8 border-black"
          }
        />
      )}

      <section id="files" className="flex flex-col items-center">
        <div className="mt-36 flex flex-col items-center gap-3 text-2xl text-gray">
          <CloudArrowUp weight="bold" size={24} />

          <button
            data-testid="upload"
            onClick={() => fileInput.current?.click()}
          >
            Drop files to stream them to the other end
          </button>
          <input
            ref={fileInput}
            type="file"
            className="hidden"
            onChange={(e) => onDrop(Array.from(e.currentTarget.files ?? []))}
          />
        </div>

        {tunnelIds.length > 0 && (
          <ul
            className={clsx(
              "mt-24 text-2xl",
              "grid grid-cols-3 gap-4 items-center"
            )}
          >
            {tunnelIds.map((t) => (
              <Upload key={t} tunnelId={t} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
};

type UploadProps = { tunnelId: string };
const Upload = ({ tunnelId }: UploadProps) => {
  const {
    name,
    size,
    progress: uploaded,
  } = useStore((s) => s.tunnels[tunnelId]);
  const progress = (uploaded / size) * 100;

  return (
    <>
      <span className="text-lg text-right">{name}</span>
      <span className="text-lg text-gray">{formatSize(size)}</span>
      {progress < 100 ? (
        <Progress progress={progress} />
      ) : (
        <Check weight="bold" size={16} />
      )}
    </>
  );
};

const formatSize = (size: number): string => {
  // The font I'm using does not have lowercase letters lol, so avoid confusion
  // and just use Mb instead of MiB
  if (size < 1_000) return `${size} B`;
  if (size < 1_000_000) return `${(size / 1_000).toFixed(2)} KB`;
  if (size < 1_000_000_000) return `${(size / 1_000_000).toFixed(2)} MB`;
  if (size < 1_000_000_000_000)
    return `${(size / 1_000_000_000).toFixed(2)} GB`;
  else return `${(size / 1_000_000_000_000).toFixed(2)} TB`;
};
