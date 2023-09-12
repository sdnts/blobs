import clsx from "clsx";
import { toast } from "sonner";
import { navigate, useStore } from "../store";

export const NewButton = () => {
  const setState = useStore((s) => s.setState);

  const createTunnel = () => {
    sessionStorage.clear();

    const t = toast.loading("Creating tunnel");

    fetch(
      `http${import.meta.env.PROD ? "s" : ""}://${
        import.meta.env.PUBLIC_API_HOST
      }/new`,
      { method: "PUT" }
    )
      .then((res) => res.json())
      .then((res: { secret: string; token: string }) => {
        if (!res.secret || !res.token)
          throw new Error("Malformed API response");

        toast.dismiss(t);
        setState("waiting");

        // I'd have liked to use a session cookie for auth, but I really want
        // tab-level storage: stuff that is unique to a tab, that gets pruned
        // when it is closed.
        sessionStorage.setItem("secret", res.secret);
        sessionStorage.setItem("token", res.token);
        sessionStorage.setItem("peerId", "1");

        navigate("/tunnel/new");
      })
      .catch(() =>
        toast.error("Could not create tunnel", {
          id: t,
          duration: 10_000,
          description: (
            <span>
              Please try again in a bit, or{" "}
              <a
                href="https://github.com/sdnts/blobs/issues/new"
                className="underline"
                target="_blank"
                rel="noreferrer"
              >
                report an issue
              </a>
            </span>
          ),
        })
      );
  };

  return (
    <button
      type="submit"
      className={clsx(
        "bg-black text-white",
        "px-6 py-3",
        "rounded-lg select-none",
        "transition-all duration-300 hover:scale-105 hover:shadow-lg active:scale-95 active:shadow-sm",
        "text-2xl md:text-4xl lg:text-3xl text-center"
      )}
      onClick={createTunnel}
      data-testid="new"
    >
      Send
    </button>
  );
};
