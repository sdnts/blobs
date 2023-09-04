import { Fragment, useEffect, useRef, useState } from "react";
import { formatSize, useStore } from "../store";
import clsx from "clsx";
import { animate, timeline } from "motion";

export const Join = () => {
  const state = useStore((s) => s.state);
  const setState = useStore((s) => s.setState);
  const blobs = useStore((s) => s.blobs);

  const [secret, setSecret] = useState("");
  const secretInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (secret === null || secret.length !== 6) return;

    fetch(
      `http${import.meta.env.PROD ? "s" : ""}://${import.meta.env.PUBLIC_API_HOST
      }/join?s=${secret}`,
      { method: "PUT" }
    )
      .then((res) => {
        if (res.status === 200) return res.json();
        return Promise.reject();
      })
      .then((res: { auth: string }) => {
        sessionStorage.setItem("auth", res.auth);
        sessionStorage.setItem("peerId", "2");

        setState("ready");
        location.pathname = "/tunnel";
      })
      .catch(() => {
        secretInput.current?.focus();
        animate(secretInput.current!, { outlineColor: "#F52F2F" });
        timeline(
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
        );
      });
  }, [secret]);

  return (
    <main className="flex-1 flex flex-col items-center gap-8 pt-36">
      <section id="secret" className="flex flex-col items-center gap-8">
        <span className="text-gray text-2xl">Secret</span>
        <input
          ref={secretInput}
          className={clsx(
            "w-[9ch]",
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

      {state === "ready" && blobs.length === 0 && (
        <>
          <span className="text-black text-2xl">Waiting for files</span>
          <span className="text-gray text-xl">Drop files on the other end</span>
        </>
      )}

      {state === "ready" && (
        <section id="files" className="flex flex-col items-center">
          {blobs.length > 0 && (
            <ul className={clsx("mt-24 text-2xl", "grid grid-cols-2 gap-4")}>
              {blobs.map((f) => (
                <Fragment key={f.name}>
                  <li className="text-right">
                    <a
                      href={`//${import.meta.env.PUBLIC_API_HOST}/download?id=${f.id
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
