import clsx from "clsx";
import { animate, timeline } from "motion";
import { useEffect, useState } from "react";
import { useStore } from "../store";

export const Status = () => {
  const session = useStore((s) => s.session);

  const [state, setState] = useState<
    "waiting" | "ready" | "reconnecting" | "disconnected"
  >("waiting");
  useEffect(() => {
    // A change in the session's readyState does not cause a store update, which
    // means there's no way for this component to know when that happens.
    // So instead of using a straight-forward selector (why would anything be
    // straight-forward in React anymore?), we have to pull shenanigans to make
    // sure we always know the correct state of the connection.

    if (!session) return setState("waiting");
    if (!location.pathname.includes("/tunnel")) return setState("waiting");

    const listener = new AbortController();
    session?.addEventListener("open", () => setState("ready"));
    session?.addEventListener("close", () => setState("reconnecting"));
    session?.addEventListener("error", () => setState("disconnected"));

    return () => listener.abort();
  }, [session]);

  useEffect(() => {
    animate(
      "#status",
      {
        fill: clsx({
          "#FFA800": state === "waiting" || state === "reconnecting",
          "#8AD22E": state === "ready",
          "#F52F2F": state === "disconnected",
        }),
      },
      { duration: 0.1 }
    );

    timeline([
      [".status-text", { transform: "translateX(-7rem)" }, { duration: 0.1 }],
      [".status-text", { transform: "translateX(0)" }, { duration: 0.3 }],
    ]);
  }, [state]);

  return (
    <p className="overflow-hidden">
      <span
        className={clsx(
          "text-md text-gray",
          "mt-[0.2rem]", // IDK, I think the font's baseline is messed up?
          "cursor-default select-none",
          "block",
          "status-text"
        )}
        data-testid="status"
      >
        {state}
      </span>
    </p>
  );
};
