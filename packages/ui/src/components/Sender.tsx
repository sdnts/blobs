import { Message, MessageCode } from "@blobs/protocol";
import { CloudArrowUp } from "@phosphor-icons/react";
import clsx from "clsx";
import { animate } from "motion";
import { Fragment, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { useWebSocket } from "../hooks/useWebSocket";
import { formatSize, useSenderStore } from "../store";

export const Sender = () => {
  const state = useSenderStore((s) => s.state);
  const setState = useSenderStore((s) => s.setState);

  const secret = useSenderStore((s) => s.secret);
  const setSecret = useSenderStore((s) => s.setSecret);

  const blobs = useSenderStore((store) => store.blobs);
  const addBlob = useSenderStore((store) => store.addBlob);

  useEffect(() => {
    if (state === "ready") {
      animate("#secret", { marginTop: "-3rem" }, { duration: 0.5 });
      animate(
        "#secret > span",
        {
          fontSize: "2.25rem",
          lineHeight: "2.5rem",
          letterSpacing: "0.05rem",
        },
        { duration: 0.5 }
      );
    }
  }, [state]);

  const fileStreams = useRef<
    Record<number, ReadableStreamDefaultReader<Uint8Array>>
  >({});

  const { open, getRootProps, getInputProps, isDragActive } = useDropzone({
    noClick: true,
    noKeyboard: true,
    preventDropOnDocument: true,
    onDrop: (f) => {
      f.forEach((f) => {
        const blob = addBlob(f);
        wsSend({
          code: MessageCode.Metadata,
          id: blob.id,
          name: blob.name,
          size: blob.size,
          type: blob.type,
        });
      });
    },
  });

  const { send: wsSend } = useWebSocket({
    onMessage: async (message: Message) => {
      switch (message.code) {
        case MessageCode.ReceiverJoined: {
          setState("ready");

          console.log("Announcing");
          blobs.forEach((f) => {
            // Announce all uploaded files
            wsSend({
              code: MessageCode.Metadata,
              id: f.id,
              name: f.name,
              size: f.size,
              type: f.type,
            });
          });
          break;
        }

        case MessageCode.Secret: {
          setSecret(message.secret);
          break;
        }

        case MessageCode.DataRequest: {
          console.log(
            "Receiver requesting",
            message.id,
            blobs,
            fileStreams.current
          );

          if (!fileStreams.current) return;

          const blob = blobs.find((b) => b.id === message.id);
          if (!blob) return;

          let stream = fileStreams.current[message.id];
          if (!stream) {
            stream = fileStreams.current[message.id] = blob.handle
              .stream()
              .pipeThrough<Uint8Array>(new CompressionStream("gzip"))
              .getReader();
          }

          // DO has a 1MiB incoming message limit, so we'll send 1MB at a time
          // This allows us ample space for any extra bytes our serialization
          // might add.
          const CHUNK_SIZE = 100_000_000;

          const { done, value } = await stream.read();
          if (done) {
            console.log("Finished reading");
            wsSend({
              code: MessageCode.DataChunk,
              id: message.id,
              offset: 0,
              bytes: new Uint8Array(0),
            });
            wsSend({
              code: MessageCode.DataChunkEnd,
              id: message.id,
            });
            break;
          }

          const parts = Math.ceil(value.byteLength / CHUNK_SIZE);
          console.log(`Will send ${parts} parts`);
          for (let p = 0; p < parts; p++) {
            const offset = p * CHUNK_SIZE;
            const bytes = value.slice(offset, offset + CHUNK_SIZE);
            wsSend({
              code: MessageCode.DataChunk,
              id: message.id,
              offset,
              bytes,
            });
          }

          wsSend({
            code: MessageCode.DataChunkEnd,
            id: message.id,
          });
          break;
        }
      }
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
          <span className="text-gray text-2xl tracking-normal">
            Use this secret to receive
          </span>
        )}
        <span className="font-bold text-9xl tracking-widest">{secret}</span>
      </section>

      <section id="files" className="flex flex-col items-center">
        {blobs.length > 0 && (
          <ul className={clsx("mt-24 text-2xl", "grid grid-cols-2 gap-4")}>
            {blobs.map((f) => (
              <Fragment key={f.name}>
                <li className="text-right">{f.name}</li>
                <span className="text-gray">{formatSize(f.size)}</span>
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
