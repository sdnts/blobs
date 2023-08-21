import { MessageCode } from "@blobs/protocol";
import clsx from "clsx";
import { useEffect, useState } from "react";
import OtpInput, { InputProps } from "react-otp-input";
import { useSSE } from "../hooks/useSSE";

type FileMetadata = {
  id: number;
  name: string;
  size: number;
  type: string;
};

export const Receive = () => {
  const [secret, setSecret] = useState("");
  const [files, setFiles] = useState<FileMetadata[]>([]);

  const { connect, connecting, connected } = useSSE({
    onMessage: (e) => {
      if (e.code !== MessageCode.Metadata) return;

      setFiles((f) => [...f, e]);
    },
  });

  useEffect(() => {
    if (secret.length < 6) return;

    const disconnect = connect(secret);
  }, [secret]);

  return (
    <main className="flex-1 flex flex-col items-center gap-8 pt-36">
      <span className="text-gray text-2xl">Secret</span>
      <OtpInput
        value={secret}
        numInputs={6}
        shouldAutoFocus
        renderInput={Digit}
        onChange={setSecret}
      />

      {connecting && <div>Loading</div>}

      {connected && files.length === 0 && (
        <>
          <span className="text-black text-2xl">Waiting for files</span>
          <span className="text-gray text-xl">Drop files on the other end</span>
        </>
      )}

      {connected && (
        <ul>
          {files.map((f) => (
            <li key={f.name}>
              <a
                href={`//${import.meta.env.PUBLIC_API_HOST}/download?id=${
                  f.id
                }`}
              >
                {f.name} ({String(f.size)})
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
};

const Digit = (props: InputProps) => (
  <input
    {...props}
    className={clsx(
      "mx-2",
      "font-bold text-9xl bg-transparent",
      {
        "border-b-4 border-black border-spacing-4": props.value === "",
      },
      "focus:border-0 focus:ring-8 focus:ring-black focus:rounded-sm",
      "outline-none"
    )}
  />
);
