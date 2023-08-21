import { Message, MessageCode } from "@blobs/protocol";
import { CloudArrowUp } from "phosphor-react";
import { useCallback, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { useWebSocket } from "../hooks/useWebSocket";

export const Send = () => {
  const files = useRef<File[]>([]);
  const fileStreams = useRef<Array<ReadableStreamDefaultReader<Uint8Array>>>(
    []
  );

  const onMessage = useCallback(
    async (message: Message) => {
      switch (message.code) {
        case MessageCode.Joined: {
          console.log("Receiver joined");
          break;
        }

        case MessageCode.DataRequest: {
          console.log("Receiver requesting", message.id, files, fileStreams);

          if (!files.current) return;
          if (!fileStreams.current) return;

          const file = files.current[message.id];
          if (!file) return;

          let stream = fileStreams.current[message.id];
          if (!stream) {
            stream = fileStreams.current[message.id] = file
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
    [files]
  );

  const { secret, send: wsSend } = useWebSocket({
    onMessage,
    onError: console.error,
    onClose: console.info,
  });

  const { open, getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (f) => {
      console.log("Dropped", f);
      files.current = [...(files.current ?? []), ...f];
      f.forEach((f) =>
        wsSend({
          code: MessageCode.Metadata,
          id: 0,
          name: f.name,
          size: f.size,
          type: f.type || "application/octet-stream",
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
        <span className="font-bold text-9xl tracking-widest">{secret}</span>

        <div className="mt-36 flex gap-3 text-xl text-gray">
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
