"use client";

import { FormEvent, useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { signIn, signUp } from "@/lib/auth/auth-client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import BrandMark from "@/components/brand-mark";
import { logger } from "@/lib/logger";
import { purgePrivateCaches } from "@/lib/pwa/private-cache";

interface AuthFormProps {
  mode: "sign-in" | "sign-up";
  /** In-app path to land on once authenticated. Already sanitised by the page. */
  redirectTo?: string;
}

function AuthForm({ mode, redirectTo = "/" }: AuthFormProps) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSignUp = mode === "sign-up";

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      setError(null);
      setLoading(true);

      try {
        if (isSignUp) {
          const { error } = await signUp.email({
            name,
            email,
            password,
          });

          if (error) {
            throw new Error(error.message);
          }
        } else {
          const { error } = await signIn.email({
            email,
            password,
            callbackURL: redirectTo,
          });

          if (error) {
            throw new Error(error.message);
          }
        }

        // The other half of the sign-out purge, and the half that actually
        // holds: sign-out can be skipped by closing the app, but arriving here
        // means a session is starting. Whatever the last one cached — possibly
        // somebody else's ledger on a shared phone — goes now.
        await purgePrivateCaches();

        router.push(redirectTo);
        router.refresh();
      } catch (error) {
        logger.error("Authentication Failed", error);
        setError(error instanceof Error ? error.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [isSignUp, name, email, password, redirectTo, router],
  );

  const alternateHref = (() => {
    const path = isSignUp ? "/sign-in" : "/sign-up";

    return redirectTo === "/" ? path : `${path}?redirect=${encodeURIComponent(redirectTo)}`;
  })();

  return (
    <main className="bg-background flex min-h-svh items-center justify-center px-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-6">
          {/*
            The card is the first thing anybody sees of this app, and until now
            it never said whose it was. The mark is `decorative` because the
            wordmark beside it already carries the name — without that, a screen
            reader announces "FinanceFlow FinanceFlow" for one logo.
          */}
          <div className="mb-6 flex items-center gap-2.5">
            <BrandMark className="size-7 shrink-0" gradientId="ff-auth-mark-gradient" decorative />

            {/*
              Set like the splash's wordmark rather than like a heading — same
              uppercase, same tracking, same muted colour. It is branding, not
              the page's title, and at heading weight it competed with the one
              real heading directly beneath it.
            */}
            <span className="text-muted-foreground text-sm font-medium tracking-[0.14em] uppercase">
              FinanceFlow
            </span>
          </div>

          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            {isSignUp ? "Create an account" : "Welcome back"}
          </h1>

          <p className="text-muted-foreground mt-1 text-sm">
            {isSignUp ? "Sign up to get started" : "Sign in to your account to continue"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {isSignUp && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>

              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>

            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>

            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              minLength={8}
              required
            />
          </div>

          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Please wait..." : isSignUp ? "Create account" : "Sign in"}
          </Button>
        </form>

        <p className="text-muted-foreground mt-6 text-center text-sm">
          {isSignUp ? "Already have an account? " : "Don't have an account? "}

          <Link
            href={alternateHref}
            className="text-foreground font-medium underline-offset-4 hover:underline"
          >
            {isSignUp ? "Sign in" : "Sign up"}
          </Link>
        </p>
      </Card>
    </main>
  );
}

export default AuthForm;
