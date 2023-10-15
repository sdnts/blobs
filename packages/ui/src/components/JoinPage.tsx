import clsx from "clsx";
import { animate, timeline } from "motion";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useStore } from "../store";
import { navigate } from "astro:transitions/client";

export const JoinPage = () => {
  const join = useStore((s) => s.join);
  const [secret, setSecret] = useState("");
  const secretInput = useRef<HTMLInputElement>(null);

  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const t = toast(
      <span data-testid="toast-join">You'll find your secret on the host</span>,
      { duration: Infinity }
    );

    return () => {
      toast.dismiss(t);
    };
  }, []);

  useEffect(() => {
    if (secret === null || secret.length !== 6) return;

    setConnecting(true);
    join(secret)
      .then(() => navigate("/tunnel"))
      .catch(() => {
        setConnecting(false);

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
        ).finished.then(() => secretInput.current?.focus());
      });
  }, [secret]);

  return (
    <main className="flex-1 flex flex-col items-center gap-8 pt-36">
      <section id="secret" className="flex flex-col items-center gap-8">
        <span className="text-gray dark:text-lightGray text-4xl">Secret</span>
        <input
          ref={secretInput}
          name="secret"
          data-testid="secret"
          className={clsx(
            "w-[9ch]",
            "px-4 pt-6 pb-2",
            "font-bold text-7xl md:text-9xl text-center text-black dark:text-black",
            "bg-lightGray dark:bg-white rounded-md",
            "focus:outline outline-black dark:outline-white outline-4"
          )}
          autoFocus
          autoComplete="off"
          disabled={connecting}
          pattern="[a-zA-Z0-9]+"
          maxLength={6}
          value={secret}
          onChange={(e) =>
            !e.currentTarget.validity.patternMismatch &&
            !e.currentTarget.validity.tooLong &&
            setSecret(e.currentTarget.value.toUpperCase())
          }
        />
        <span className="text-gray dark:text-lightGray text-2xl">
          This is displayed on the host
        </span>
      </section>
    </main>
  );
};
