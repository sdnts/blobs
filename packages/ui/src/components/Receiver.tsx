import { MessageCode } from "@blobs/protocol";
import clsx from "clsx";
import { Fragment, useEffect, useRef, useState } from "react";
import { useSSE } from "../hooks/useSSE";
import { formatSize, useReceiverStore } from "../state";
import { animate, timeline } from "motion";

type FileMetadata = {
  id: number;
  name: string;
  size: number;
  type: string;
};

export const Receiver = () => {
  const state = useReceiverStore((s) => s.state);

  const secretInput = useRef<HTMLInputElement>(null);
  const secret = useReceiverStore((s) => s.secret);
  const setSecret = useReceiverStore((s) => s.setSecret);

  const [files, setFiles] = useState<FileMetadata[]>([]);

  const { connect } = useSSE({
    onOpen: () => {
      timeline([
        ["#secret", { transform: "translateY(0)", opacity: 1 }],
        [
          "#secret",
          {
            transform: "translateY(-2rem)",
            opacity: 0,
            height: 0,
            overflow: "hidden",
          },
        ],
      ]);
    },
    onMessage: (e) => {
      if (e.code !== MessageCode.Metadata) return;

      setFiles((f) => [...f, e]);
    },
    onError: async () => {
      animate(secretInput.current!, { outlineColor: "#F52F2F" });
      await timeline(
        [
          [
            secretInput.current!,
            { transform: "translateX(-0.3rem)" },
            { duration: 0.05 },
          ],
          [
            secretInput.current!,
            { transform: "translateX(0.3rem)" },
            { duration: 0.05 },
          ],
        ],
        { repeat: 2 }
      ).finished;
      secretInput.current?.focus();
    },
  });

  useEffect(() => {
    if (secret.length !== 6) return;

    const disconnect = connect(secret);
  }, [secret]);

  return (
    <main className="flex-1 flex flex-col items-center gap-8 pt-36">
      <section id="secret" className="flex flex-col items-center gap-8">
        <span className="text-gray text-2xl">Secret</span>
        <input
          ref={secretInput}
          className={clsx(
            "w-6/12",
            "px-4 pt-6 pb-2",
            "font-bold text-9xl text-center",
            "bg-lightGray rounded-md",
            "focus:outline outline-black outline-4"
          )}
          autoFocus
          autoComplete="off"
          disabled={state === "connecting"}
          pattern="[a-zA-Z0-9]+"
          maxLength={6}
          value={secret}
          onChange={(e) =>
            !e.currentTarget.validity.patternMismatch &&
            !e.currentTarget.validity.tooLong &&
            setSecret(e.currentTarget.value)
          }
        />
      </section>

      {state === "ready" && files.length === 0 && (
        <>
          <span className="text-black text-2xl">Waiting for files</span>
          <span className="text-gray text-xl">Drop files on the other end</span>
        </>
      )}

      {state === "ready" && (
        <section id="files" className="flex flex-col items-center">
          {files.length > 0 && (
            <ul className={clsx("mt-24 text-2xl", "grid grid-cols-2 gap-4")}>
              {files.map((f) => (
                <Fragment key={f.name}>
                  <li className="text-right">
                    <a
                      href={`//${import.meta.env.PUBLIC_API_HOST}/download?id=${
                        f.id
                      }`}
                    >
                      <span className="text-right">{f.name}</span>
                    </a>
                  </li>
                  <span className="text-gray">{formatSize(f.size)}</span>
                </Fragment>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
};
