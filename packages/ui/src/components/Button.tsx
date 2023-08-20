import clsx from "clsx";
import type { PropsWithChildren } from "react";

type Props = PropsWithChildren<{ onClick?: () => void }>;

export function Button({ onClick, children }: Props) {
  return (
    <button
      className={clsx(
        "bg-black text-white",
        "px-6 py-3",
        "rounded-lg",
        "text-3xl"
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
