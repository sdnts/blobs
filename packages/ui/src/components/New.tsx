import clsx from "clsx";
import { useEffect } from "react";

export const New = () => {
  useEffect(() => {
    sessionStorage.clear();

    fetch(
      `http${import.meta.env.PROD ? "s" : ""}://${import.meta.env.PUBLIC_API_HOST
      }/new`,
      { method: "PUT" }
    )
      .then((res) => res.json())
      .then((res: { secret: string; auth: string }) => {
        if (!res.secret || !res.auth) throw new Error("Malformed API response");

        // I'd have liked to use a session cookie for this stuff, but I really
        // want tab-level storage: stuff that is unique to a tab, and that gets
        // pruned when it is closed.
        sessionStorage.setItem("secret", res.secret);
        sessionStorage.setItem("auth", res.auth);
        sessionStorage.setItem("peerId", "1");
        location.pathname = "/tunnel";
      });
  }, []);

  return (
    <main className="flex-1 flex flex-col items-center">
      <section className={clsx("flex flex-col items-center gap-4", "mt-36")}>
        <span className="text-gray text-2xl tracking-normal">
          Use this secret to receive
        </span>
        <span
          id="secret"
          className="block animate-pulse text-9xl tracking-widest w-[9ch] bg-gray"
        >
          ------
        </span>
      </section>
    </main>
  );
};
