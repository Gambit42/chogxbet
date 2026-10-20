import type { HTMLAttributes } from "react";

type ContainerProps = HTMLAttributes<HTMLElement> & {
  as?: "div" | "main" | "section";
};

export function Container({ as: Tag = "div", className = "", ...props }: ContainerProps) {
  return <Tag className={`mx-auto w-full max-w-[1200px] px-4 sm:px-6 ${className}`} {...props} />;
}
