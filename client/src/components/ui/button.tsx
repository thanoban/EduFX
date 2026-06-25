import type { ButtonHTMLAttributes, PropsWithChildren, ReactNode } from "react";

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "ghost";
    icon?: ReactNode;
  }
>;

export function Button({
  children,
  className = "",
  icon,
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button className={`button ${variant} ${className}`.trim()} {...props}>
      {icon ? <span className="button__icon">{icon}</span> : null}
      {children}
    </button>
  );
}
