"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonVariant } from "./ui";

/** Submit button that disables itself while its form's server action runs. */
export function SubmitButton({
  children,
  pendingText,
  variant,
  name,
  value,
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: ButtonVariant;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending} aria-busy={pending} name={name} value={value}>
      {pending ? (pendingText ?? "Saving…") : children}
    </Button>
  );
}
