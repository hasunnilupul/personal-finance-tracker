"use client";

import { FormEvent, useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { signIn, signUp } from "@/lib/auth/auth-client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AuthCard from "@/components/auth-card";
import TwoFactorChallenge from "@/components/two-factor-challenge";
import { logger } from "@/lib/logger";
import { purgePrivateCaches } from "@/lib/pwa/private-cache";

interface AuthFormProps {
  mode: "sign-in" | "sign-up";
  /** In-app path to land on once authenticated. Already sanitised by the page. */
  redirectTo?: string;
  /** Good news to show above the form, such as a password having just been reset. */
  notice?: string;
}

function AuthForm({ mode, redirectTo = "/", notice }: AuthFormProps) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // True once the password was accepted for an account with two-factor on.
  const [challenged, setChallenged] = useState(false);

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
          const { data, error } = await signIn.email({
            email,
            password,
            callbackURL: redirectTo,
          });

          if (error) {
            throw new Error(error.message);
          }

          // The password was right but the account wants a second factor, so
          // there is no session yet. Swap in the code step and stop here — the
          // purge and the redirect below belong to the end of the last step.
          if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
            setChallenged(true);
            setPassword("");

            return;
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

  if (challenged) {
    return <TwoFactorChallenge redirectTo={redirectTo} onStartOver={() => setChallenged(false)} />;
  }

  const alternateHref = (() => {
    const path = isSignUp ? "/sign-in" : "/sign-up";

    return redirectTo === "/" ? path : `${path}?redirect=${encodeURIComponent(redirectTo)}`;
  })();

  return (
    <AuthCard
      title={isSignUp ? "Create an account" : "Welcome back"}
      description={isSignUp ? "Sign up to get started" : "Sign in to your account to continue"}
    >
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
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>

            {!isSignUp && (
              <Link
                href="/forgot-password"
                className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
              >
                Forgot password?
              </Link>
            )}
          </div>

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

        {notice && !error && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400" role="status">
            {notice}
          </p>
        )}

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
    </AuthCard>
  );
}

export default AuthForm;
