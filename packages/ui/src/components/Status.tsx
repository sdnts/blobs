import clsx from "clsx";
import { animate, timeline } from "motion";
import { useEffect, useState } from "react";
import { useStore } from "../store";
import ReconnectingWebSocket from "partysocket/ws";

type State = "waiting" | "ready" | "reconnecting";

export const Status = () => {
  const session = useStore((s) => s.session);
  const [state, setState] = useState<State>("waiting");

  useEffect(() => {
    if (location.pathname === "/tunnel") return setState("ready");
    if (!session) return setState("waiting");
    console.log(session.readyState, ReconnectingWebSocket.OPEN);
    if (session.readyState === ReconnectingWebSocket.OPEN)
      return setState("ready");
    return setState("reconnecting");
  }, [session, session?.readyState]);

  useEffect(() => {
    animate(
      "#status",
      {
        fill: clsx({
          "#FFA800": state === "waiting" || state === "reconnecting",
          "#8AD22E": state === "ready",
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
        {state === "waiting" && "Waiting"}
        {state === "ready" && "Ready"}
        {state === "reconnecting" && "Reconnecting"}
      </span>
    </p>
  );
};
