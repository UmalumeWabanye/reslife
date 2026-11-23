"use client";

import { useActionState } from "react";
import { login } from "@/app/auth-actions";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Card } from "@/components/ui";

export function LoginForm() {
  const [state, action] = useActionState(login, undefined);
  return (
    <Card>
      <form action={action} className="space-y-4">
        <Alert>{state?.error}</Alert>
        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.email} className="input" />
        </div>
        <div>
          <label htmlFor="password" className="label">
            Password
          </label>
          <input id="password" name="password" type="password" autoComplete="current-password" required minLength={8} className="input" />
        </div>
        <div className="pt-2 [&>button]:w-full">
          <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
        </div>
      </form>
    </Card>
  );
}
