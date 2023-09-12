import clsx from "clsx";
import { animate, timeline } from "motion";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { navigate } from "../store";

export const JoinPage = () => {
  const [secret, setSecret] = useState("");
  const secretInput = useRef<HTMLInputElement>(null);

  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    toast("You'll find your secret on the host", { duration: Infinity });
  }, []);

  useEffect(() => {
    if (secret === null || secret.length !== 6) return;

    const t = toast.loading("Joining tunnel");
    sessionStorage.clear();
    setConnecting(true);

    fetch(
      `http${import.meta.env.PROD ? "s" : ""}://${
        import.meta.env.PUBLIC_API_HOST
      }/join?s=${secret}`,
      { method: "PUT" }
    )
      .finally(() => {
        setConnecting(false);
      })
      .then((res) => {
        if (res.status === 200) return res.json();
        return Promise.reject();
      })
      .then((res: { token: string }) => {
        if (!res.token) throw new Error("Malformed API response");

        toast.dismiss();
        sessionStorage.setItem("token", res.token);
        sessionStorage.setItem("peerId", "2");

        navigate("/tunnel");
      })
      .catch(() => {
        toast.error("Could not join tunnel, please try again in a bit!", {
          id: t,
          duration: 10_000,
          description: (
            <a
              href="https://github.com/sdnts/blobs/issues/new"
              className="underline"
              target="_blank"
              rel="noreferrer"
            >
              Report an issue
            </a>
          ),
        });

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
          name="secret"
          className={clsx(
            "w-[9ch]",
            "px-4 pt-6 pb-2",
            "font-bold text-9xl text-center",
            "bg-lightGray rounded-md",
            "focus:outline outline-black outline-4"
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
      </section>
    </main>
  );
};
