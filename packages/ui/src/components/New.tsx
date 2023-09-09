import clsx from "clsx";
import { toast } from "sonner";
import { ErrorToast } from "./Toasts";

export const New = () => {
  const createTunnel = () => {
    const t = toast.loading("Creating tunnel", { duration: 5000 });
    sessionStorage.clear();

    fetch(
      `http${import.meta.env.PROD ? "s" : ""}://${import.meta.env.PUBLIC_API_HOST
      }/new`,
      { method: "PUT" }
    )
      .then((res) => res.json())
      .then((res: { secret: string; token: string }) => {
        if (!res.secret || !res.token)
          throw new Error("Malformed API response");

        toast.success("Ready", { id: t, duration: 5000 });

        // I'd have liked to use a session cookie for auth, but I really want
        // tab-level storage: stuff that is unique to a tab, that gets pruned
        // when it is closed.
        sessionStorage.setItem("secret", res.secret);
        sessionStorage.setItem("token", res.token);
        sessionStorage.setItem("peerId", "1");
        location.pathname = "/tunnel";
      })
      .catch((e) =>
        toast.error(
          <ErrorToast>
            Unable to create a tunnel, please try again in a bit!
          </ErrorToast>,
          { id: t, duration: 10_000, description: e.message }
        )
      );
  };

  return (
    <button
      className={clsx(
        "bg-black text-white",
        "px-6 py-3",
        "rounded-lg",
        "text-2xl md:text-4xl lg:text-3xl text-center"
      )}
      onClick={createTunnel}
    >
      Send
    </button>
  );
};
