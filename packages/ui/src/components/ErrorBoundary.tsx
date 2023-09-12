import { Skull } from "@phosphor-icons/react";
import clsx from "clsx";
import { Component, type ErrorInfo, type PropsWithChildren } from "react";
import { toast } from "sonner";

type Props = PropsWithChildren<{}>;
type State = {
  error?: Error;
  errorInfo?: ErrorInfo;
};

export class ErrorBoundary extends Component<Props, State> {
  state = { error: undefined, errorInfo: undefined };

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.error !== undefined) {
      return (
        <main
          className={clsx(
            "mt-36",
            "flex flex-col justify-center items-center gap-12",
            "text-black"
          )}
        >
          <Skull size={128} />

          <div className="flex flex-col items-center gap-2">
            <span className="text-4xl">Fatal</span>
            <span className="text-xl text-gray">
              An unrecoverable error has occured
            </span>
          </div>

          <div className="flex gap-6">
            <a href="/" className="text-xl text-black">
              Start over
            </a>
            <a
              href="https://github.com/sdnts/blobs/issues/new"
              className="text-xl text-gray"
            >
              Report a bug
            </a>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
