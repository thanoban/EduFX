import Link from "next/link";
import type { ButtonHTMLAttributes, MouseEvent, PropsWithChildren, ReactNode } from "react";

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "ghost";
    icon?: ReactNode;
    href?: string;
  }
>;

export function Button({
  children,
  className = "",
  icon,
  href,
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  const buttonClassName = `button ${variant} ${className}`.trim();

  if (href) {
    const { onClick, disabled } = props;
    const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
      if (disabled) {
        event.preventDefault();
        return;
      }
      onClick?.(event as unknown as MouseEvent<HTMLButtonElement>);
    };

    return (
      <Link
        href={href}
        className={buttonClassName}
        aria-disabled={disabled || undefined}
        onClick={handleClick}
      >
        {icon ? <span className="button__icon">{icon}</span> : null}
        {children}
      </Link>
    );
  }

  return (
    <button type={type} className={buttonClassName} {...props}>
      {icon ? <span className="button__icon">{icon}</span> : null}
      {children}
    </button>
  );
}
