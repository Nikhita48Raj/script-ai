import React, { useEffect, useState } from "react";
import { animate } from "framer-motion";

export function CountUp(props: { value: number; durationMs?: number; format?: (n: number) => string }) {
  const { value, durationMs = 900, format } = props;
  const [display, setDisplay] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    const start = display;
    const end = value ?? 0;

    animate(start, end, {
      duration: durationMs / 1000,
      ease: "easeOut",
      onUpdate: (latest: number) => {
        if (cancelled) return;
        setDisplay(latest);
      },
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const out = format ? format(display) : display.toFixed(2);
  return <span>{out}</span>;
}

