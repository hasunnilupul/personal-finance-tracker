"use client";

import { FormEvent, useCallback, useState } from "react";
import Link from "next/link";

import AuthCard from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/lib/auth/auth-client";
import { logger } from "@/lib/logger";

/**
 * Asks for a reset link.
 *
 * **The answer never depends on whether the address has an account.** The server
 * replies the same either way, and this form says the same either way — "if
 * there is an account" — because a page that confirmed which addresses exist
 * would be a way to list the family's.
 */
const ForgotPasswordForm = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      setError(null);
      setLoading(true);

      try {
        const { error } = await requestPasswordReset({
          email,
          // The page better-auth sends the person to once it has checked the
          // token in the emailed link. A relative path, so it is the same
          // origin the request was made from.
          redirectTo: "/reset-password",
        });

        if (error) {
          throw new Error(error.message);
        }

        setSent(true);
      } catch (error) {
        logger.error("Password reset request failed", error);
        setError(error instanceof Error ? error.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [email],
  );

  if (sent) {
    return (
      <AuthCard
        title="Check your email"
        description={`If there is an account for ${email}, a link to choose a new password is on its way. It works for an hour.`}
      >
        <Link
          href="/sign-in"
          className="text-foreground text-sm font-medium underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Forgot your password?"
      description="Enter your email and we will send you a link to choose a new one."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Please wait..." : "Send reset link"}
        </Button>
      </form>

      <p className="text-muted-foreground mt-6 text-center text-sm">
        Remembered it?{" "}
        <Link
          href="/sign-in"
          className="text-foreground font-medium underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
};

export default ForgotPasswordForm;
