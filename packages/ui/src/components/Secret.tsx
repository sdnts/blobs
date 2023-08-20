import clsx from "clsx";
import { useState } from "react";
import OtpInput, { InputProps } from "react-otp-input";

export const Secret = () => {
  const [secret, setSecret] = useState("");

  return (
    <main className="flex-1 flex flex-col items-center gap-8 pt-36">
      <span className="text-gray text-2xl">Secret</span>
      <OtpInput
        value={secret}
        numInputs={6}
        shouldAutoFocus
        renderInput={Digit}
        onChange={setSecret}
      />
    </main>
  );
};

const Digit = (props: InputProps) => (
  <input
    {...props}
    className={clsx(
      "mx-4",
      "font-bold text-9xl bg-transparent",
      {
        "border-b-4 border-black border-spacing-4": props.value === "",
      },
      "focus:border-0 focus:ring-8 focus:ring-black focus:rounded-sm",
      "outline-none"
    )}
  />
);
