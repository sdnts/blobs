import clsx from "clsx";

type HeroTextProps = {
  title: string;
  children: string;
};
export const HeroText = ({ title, children }: HeroTextProps) => (
  <p title={title} className="overflow-hidden">
    <span
      className={clsx(
        "hero-text",
        "font-bold block motion-safe:-translate-y-96"
      )}
    >
      {children}
    </span>
  </p>
);
