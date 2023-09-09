import clsx from "clsx";
import { animate, timeline } from "motion";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useStore } from "../store";
import { ErrorToast } from "./Toasts";

export const Join = () => {
  const [state, setState] = useStore((s) => [s.state, s.setState]);

  const [secret, setSecret] = useState("");
  const secretInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (secret === null || secret.length !== 6) return;

    const t = toast.loading("Joining tunnel", { duration: 5000 });
    sessionStorage.clear();

    fetch(
      `http${import.meta.env.PROD ? "s" : ""}://${import.meta.env.PUBLIC_API_HOST
      }/join?s=${secret}`,
      { method: "PUT" }
    )
      .then((res) => {
        if (res.status === 200) return res.json();
        return Promise.reject();
      })
      .then((res: { token: string }) => {
        if (!res.token) throw new Error("Malformed API response");

        toast.success("Ready", { id: t, duration: 10_000 });

        sessionStorage.setItem("token", res.token);
        sessionStorage.setItem("peerId", "2");

        setState("ready");
        location.pathname = "/tunnel";
      })
      .catch(() => {
        toast.error(
          <ErrorToast>
            Could not join tunnel, please try again in a bit!
          </ErrorToast>,
          { id: t, duration: 5000 }
        );

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
    </main>
  );
};
