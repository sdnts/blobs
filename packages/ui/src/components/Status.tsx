import clsx from "clsx";
import { animate, timeline } from "motion";
import { useEffect } from "react";
import { useStore } from "../store";

export const Status = () => {
  const state = useStore((s) => s.state);

  useEffect(() => {
    animate(
      "#status",
      {
        fill: clsx({
          "#FFA800":
            state === "idle" ||
            state === "connecting" ||
            state === "reconnecting" ||
            state === "waiting",
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
      >
        {state === "connecting" && "Connecting"}
        {state === "waiting" && "Waiting"}
        {state === "ready" && "Ready"}
        {state === "reconnecting" && "Reconnecting"}
        {state === "disconnected" && "Error"}
      </span>
    </p>
  );
};
