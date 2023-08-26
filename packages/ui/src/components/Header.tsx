import clsx from "clsx";
import { timeline } from "motion";
import { useEffect } from "react";
import { useReceiverStore, useSenderStore } from "../state";

type HeaderProps = {
  mode: "sender" | "receiver";
};

export const Header = ({ mode }: HeaderProps) => {
  // Conditional hook is fine because `mode` does not change
  const state =
    mode === "sender"
      ? useSenderStore((s) => s.state)
      : useReceiverStore((s) => s.state);

  useEffect(() => {
    timeline([
      [
        ".connection-status",
        { transform: "translateX(-7rem)" },
        { duration: 0.1 },
      ],
      [".connection-status", { transform: "translateX(0)" }, { duration: 0.3 }],
    ]);
  }, [state]);

  return (
    <header
      className={clsx(
        "flex justify-between items-center",
        "pt-12 pb-12 md:pb-24",
        "text-xl"
      )}
    >
      <aside
        className="flex items-center gap-4"
        onClick={() => console.log("TODO: Reconnect")}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 128 128"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M32.9038 95.0962C29.0115 91.2038 31.5923 83.0385 29.6038 78.2577C27.6154 73.4769 20 69.2885 20 64C20 58.7115 27.5308 54.6923 29.6038 49.7423C31.6769 44.7923 29.0115 36.7962 32.9038 32.9038C36.7962 29.0115 44.9615 31.5923 49.7423 29.6038C54.5231 27.6154 58.7115 20 64 20C69.2885 20 73.3077 27.5308 78.2577 29.6038C83.2077 31.6769 91.2038 29.0115 95.0962 32.9038C98.9885 36.7962 96.4077 44.9615 98.3962 49.7423C100.385 54.5231 108 58.7115 108 64C108 69.2885 100.469 73.3077 98.3962 78.2577C96.3231 83.2077 98.9885 91.2038 95.0962 95.0962C91.2038 98.9885 83.0385 96.4077 78.2577 98.3962C73.4769 100.385 69.2885 108 64 108C58.7115 108 54.6923 100.469 49.7423 98.3962C44.7923 96.3231 36.7962 98.9885 32.9038 95.0962Z"
            fill={clsx({
              // Yellow
              "#FFA800":
                state === "idle" ||
                state === "connecting" ||
                state === "reconnecting" ||
                state === "waiting",
              // Green
              "#8AD22E": state === "ready",
              // Red
              "#F52F2F": state === "disconnected",
            })}
          />
        </svg>

        <p className="overflow-hidden">
          <span
            className={clsx(
              "text-md text-gray",
              "mt-[0.2rem]", // IDK, I think the font's baseline is messed up?
              "cursor-default select-none",
              "connection-status block"
            )}
          >
            {state === "connecting" && "Connecting"}
            {state === "waiting" && "Waiting"}
            {state === "ready" && "Ready"}
            {state === "reconnecting" && "Reconnecting"}
            {state === "disconnected" && "Error"}
          </span>
        </p>
      </aside>

      <nav>
        <ul className="flex gap-8">
          <li>
            <a href="https://github.com/sdnts/blobs" target="_blank">
              SOURCE
            </a>
          </li>
          <li>
            <a href="/about">ABOUT</a>
          </li>
        </ul>
      </nav>
    </header>
  );
};
