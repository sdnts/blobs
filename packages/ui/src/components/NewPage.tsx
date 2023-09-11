import clsx from "clsx";
import { Fragment, Suspense, useEffect } from "react";
import { suspend } from "suspend-react";
import { useWebSocket } from "../hooks/useWebSocket";
import { navigate, useStore } from "../store";
import { ErrorBoundary } from "./ErrorBoundary";
export const NewPage = () => {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Fragment />}>
        <New />
      </Suspense>
    </ErrorBoundary>
  );
};

const New = () => {
  const secret = suspend(
    () =>
      new Promise<string>((resolve, reject) => {
        const secret = sessionStorage.getItem("secret");
        if (!secret) return reject();
        return resolve(secret);
      }),
    []
  );

  useWebSocket(secret);

  const [state, setState] = useStore((s) => [s.state, s.setState]);

  useEffect(() => {
    setState("waiting");
  }, []);
  useEffect(() => {
    if (state === "ready") navigate("/tunnel");
  }, [state]);

  return (
    <main className="flex-1 flex flex-col items-center">
      <section
        id="secret"
        className={clsx("flex flex-col items-center gap-4", "mt-36")}
      >
        <>
          <span className="text-gray text-2xl tracking-normal">
            Use this secret to receive
          </span>
          <span
            data-testid="secret"
            className="font-bold text-9xl tracking-widest"
          >
            {secret}
          </span>
        </>
      </section>
    </main>
  );
};
