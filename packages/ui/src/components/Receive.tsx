import { useState } from "react";
import { useSSE } from "../hooks/useSSE";
import { MessageCode } from "@blobs/protocol";

type FileMetadata = {
  name: string;
  size: number;
};

export const Receive = () => {
  const [files, setFiles] = useState<FileMetadata[]>([]);
  useSSE({
    onMessage: (e) => {
      if (e.code !== MessageCode.Metadata) return;

      setFiles((f) => [...f, e]);
    },
  });

  return (
    <main className="flex-1 flex flex-col items-center pt-36">
      <span className="text-black text-2xl">Waiting for files</span>
      <span className="text-gray text-xl">Drop files on the other end</span>

      <ul>
        {files.map((f) => (
          <li key={f.name}>
            <a
              href={`//${
                import.meta.env.PUBLIC_API_HOST
              }/000000/download?name=${encodeURIComponent(f.name)}`}
            >
              {f.name} ({String(f.size)})
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
};
