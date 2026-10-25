"use client";

import { FormEvent, useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import AuthCard from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPassword } from "@/lib/auth/auth-client";
import { MIN_PASSWORD_LENGTH, validateNewPassword } from "@/lib/auth/password-policy";
import { logger } from "@/lib/logger";

interface ResetPasswordFormProps {
  token: string;
}

/**
 * Chooses the new password.
 *
 * On success it goes to sign-in rather than signing the person in: the reset
 * revoked every session, and proving the new password works is worth one
 * form. The sign-in page says why they are there.
 */
const ResetPasswordForm = ({ token }: ResetPasswordFormProps) => {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      const problem = validateNewPassword(password, confirm);

      if (problem) {
        setError(problem);

        return;
      }

      setError(null);
      setLoading(true);

      try {
        const { error } = await resetPassword({ newPassword: password, token });

        if (error) {
          throw new Error(error.message);
        }

        router.push("/sign-in?reset=1");
      } catch (error) {
        logger.error("Password reset failed", error);
        setError(error instanceof Error ? error.message : "Something went wrong");
        setLoading(false);
      }
    },
    [password, confirm, token, router],
  );

  return (
    <AuthCard title="Choose a new password" description="Use at least 8 characters.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-password">New password</Label>

          <Input
            id="new-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm-password">Confirm new password</Label>

          <Input
            id="confirm-password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
          />
        </div>

        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Please wait..." : "Change password"}
        </Button>
      </form>
    </AuthCard>
  );
};

export default ResetPasswordForm;
