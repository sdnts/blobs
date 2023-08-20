import { Message, MessageCode } from "@blobs/protocol";
import { clsx } from "clsx";
import { CloudArrowUp } from "phosphor-react";
import { useCallback, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { useWebSocket } from "../hooks/useWebSocket";

export const Send = () => {
  const files = useRef<File[]>();

  const onMessage = useCallback(
    async (message: Message) => {
      switch (message.code) {
        case MessageCode.Joined:
          console.log("Receiver joined");
          break;

        case MessageCode.Request:
          console.log("Receiver requesting", message.name, files);
          if (!files.current) return;

          const file = files.current.find((f) => f.name === message.name);
          if (!file) return;

          const CHUNK_SIZE = 100_000_000;
          // const CHUNK_SIZE = 570;
          let i = 0;
          const stream = file
            .stream()
            .pipeThrough(new CompressionStream("gzip"))
            .getReader();

          do {
            const { done, value } = await stream.read();
            if (done) {
              break;
            }

            // DO has a 1MiB incoming message limit, so we'll send 1MB at a time
            // This allows us ample space for the extra bytes our serialization
            // adds.
            // There's room to be more efficient here, by increasing the chunk
            // size till it is right on the limit. We can also send fewer parts
            // overall by buffering bytes across multiple `.read()`s, but I don't
            // care at the moment.
            const parts = Math.ceil(value.byteLength / CHUNK_SIZE);
            console.log(value.byteLength, parts);
            for (let p = 0; p < parts; p++) {
              const bytes = value.slice(p * CHUNK_SIZE, (p + 1) * CHUNK_SIZE);
              ws.send({
                code: MessageCode.Data,
                length: bytes.byteLength,
                bytes,
              });
              await new Promise((r) => setTimeout(r, 10));
            }
          } while (true);

          ws.send({ code: MessageCode.Sent });
          break;

        default:
          return;
      }
    },
    [files]
  );

  const ws = useWebSocket({
    onMessage,
    onError: console.error,
    onClose: console.info,
  });

  const { open, getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (f) => {
      files.current = [...(files.current ?? []), ...f];
      f.forEach((f) =>
        ws.send({
          code: MessageCode.Metadata,
          name: f.name,
          size: f.size,
        })
      );
    },
    noClick: true,
  });

  return (
    <main className="flex-1 flex justify-center pt-36" {...getRootProps()}>
      <input {...getInputProps()} />
      <section className="flex flex-col items-center gap-4">
        <span className="text-gray text-2xl">This is your secret</span>
        <span className="font-bold text-9xl tracking-widest">042187</span>

        <div className="mt-36 flex gap-3 text-xl text-gray">
          <CloudArrowUp weight="bold" size={24} />
          {isDragActive ? (
            <div
              className={clsx(
                "fixed inset-4 rounded-md border-dashed border-8 border-black"
              )}
            />
          ) : (
            <button onClick={open}>Drop Files</button>
          )}
        </div>
      </section>
    </main>
  );
};
