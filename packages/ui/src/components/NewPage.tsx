import clsx from "clsx";
import { useEffect } from "react";
import { useStore } from "../store";
import { navigate } from "astro:transitions/client";

export const NewPage = () => {
  const { secret, restore, wait } = useStore((s) => ({
    secret: s.secret,
    restore: s.restore,
    wait: s.wait,
  }));

  useEffect(() => {
    restore();
    wait().then(() => navigate("/tunnel"));
  }, []);

  return (
    <main className="flex-1 flex flex-col items-center">
      <section
        id="secret"
        className={clsx("flex flex-col items-center gap-4", "mt-36")}
      >
        <span className="text-gray dark:text-lightGray text-2xl tracking-normal">
          Use this secret to join this tunnel
        </span>
        <span
          data-testid="secret"
          className="font-bold text-9xl tracking-widest"
        >
          {secret}
        </span>
      </section>
    </main>
  );
};
