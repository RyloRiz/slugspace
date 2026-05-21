"use client";

import { usePathname } from "next/navigation";
import { BlurFade } from "./blur-fade";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <BlurFade key={pathname} duration={0.25} delay={0} offset={8} direction="up" blur="8px">
      {children}
    </BlurFade>
  );
}
