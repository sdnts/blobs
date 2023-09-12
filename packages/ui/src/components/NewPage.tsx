import clsx from "clsx";
import { Fragment, Suspense, useEffect } from "react";
import { suspend } from "suspend-react";
import { useWebSocket } from "../hooks/useWebSocket";
import { navigate, useStore } from "../store";
import { ErrorBoundary } from "./ErrorBoundary";
import { toast } from "sonner";

export const NewPage = () => {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Fragment />}>
        <New />
      </Suspense>
    </ErrorBoundary>
  );
};

type Session = {
  token: string;
  secret: string;
};

const New = () => {
  const session = suspend(
    () =>
      new Promise<Session>((resolve, reject) => {
        const secret = sessionStorage.getItem("secret");
        const token = sessionStorage.getItem("token");

        if (!secret || !token) return reject();

        return resolve({ token, secret });
      }),
    []
  );

  const state = useStore((s) => s.state);

  useWebSocket(session.token);

  useEffect(() => {
    toast.success("Tunnel created", {
      duration: Infinity,
      description: (
        <span>
          Use the secret <strong>{session.secret}</strong> to join this tunnel
        </span>
      ),
    });
  }, []);

  useEffect(() => {
    if (state === "ready") {
      sessionStorage.removeItem("secret");
      toast.dismiss();
      navigate("/tunnel");
    }
  }, [state]);

  return (
    <main className="flex-1 flex flex-col items-center">
      <section
        id="secret"
        className={clsx("flex flex-col items-center gap-4", "mt-36")}
      >
        <span className="text-gray text-2xl tracking-normal">
          Use this secret to receive
        </span>
        <span
          data-testid="secret"
          className="font-bold text-9xl tracking-widest"
        >
          {session.secret}
        </span>
      </section>
    </main>
  );
};
