import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold tracking-wide text-brand uppercase">ResLife Partners</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Sign in to your dashboard</h1>
          <p className="mt-2 text-sm text-slate-500">For residence managers and platform staff.</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
