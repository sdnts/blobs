import type { PropsWithChildren } from "react";

type Props = PropsWithChildren<{}>;
export const ErrorToast = ({ children }: Props) => (
  <span>
    {children}
    <br />
    <a
      href="https://github.com/sdnts/blobs/issues/new"
      className="underline"
      target="_blank"
      rel="noreferrer"
    >
      Report an issue
    </a>
  </span>
);
