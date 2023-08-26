import clsx from "clsx";
import { useEffect, type PropsWithChildren } from "react";
import { animate, stagger, spring } from "motion";

export const HeroText = () => {
  useEffect(() => {
    animate(
      ".hero-word",
      { transform: "translateY(0)" },
      {
        duration: 0.6,
        delay: stagger(0.05),
        easing: spring({ velocity: 100, mass: 10 }),
      }
    );
  }, []);

  return (
    <section className={clsx("leading-none", "text-[32vmin] md:text-[18vmin]")}>
      <div>
        <Word title="Airdrop" delay={0}>
          AIRDOP
        </Word>
        <Word title="for" delay={0.05}>
          FR
        </Word>
      </div>

      <div className="flex justify-between items-end">
        <div>
          <Word title="the" delay={0.1}>
            THE
          </Word>
          <Word title="Web" delay={0.15}>
            WE
          </Word>
        </div>

        <section
          className={clsx("flex flex-col gap-6", "mb-[2rem]", "font-normal")}
        >
          <a
            href="/send"
            className={clsx(
              "bg-black text-white",
              "px-6 py-3",
              "rounded-lg",
              "text-2xl md:text-4xl lg:text-3xl text-center"
            )}
          >
            Send
          </a>
          <a
            href="/receive"
            className={clsx(
              "text-black border-2 border-black",
              "px-6 py-3",
              "rounded-lg",
              "text-2xl md:text-4xl lg:text-3xl text-center"
            )}
          >
            Receive
          </a>
        </section>
      </div>
    </section>
  );
};

type WordProps = PropsWithChildren<{
  title: string;
  delay: number;
}>;
const Word = ({ title, delay, children }: WordProps) => (
  <p title={title} className="overflow-hidden">
    <span
      className={clsx("hero-word", "font-bold block -translate-y-96")}
      // style={{ animationDelay: `${delay}s`, animationFillMode: "both" }}
    >
      {children}
    </span>
  </p>
);
