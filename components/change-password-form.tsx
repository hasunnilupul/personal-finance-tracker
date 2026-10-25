"use client";

import { FormEvent, useCallback, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword } from "@/lib/auth/auth-client";
import { MIN_PASSWORD_LENGTH, validateNewPassword } from "@/lib/auth/password-policy";
import { logger } from "@/lib/logger";

/**
 * Changes the signed-in person's password.
 *
 * **Other devices are signed out, and that is not a checkbox.** Changing a
 * password is what somebody does when the old one may be known, and a session
 * left open on the other device would make the change a gesture. This device
 * keeps its session — better-auth issues it a fresh one.
 */
const ChangePasswordForm = () => {
  const [current, setCurrent] = useState("");
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

      if (password === current) {
        setError("The new password is the same as the current one.");

        return;
      }

      setError(null);
      setLoading(true);

      try {
        const { error } = await changePassword({
          currentPassword: current,
          newPassword: password,
          revokeOtherSessions: true,
        });

        if (error) {
          throw new Error(error.message);
        }

        setCurrent("");
        setPassword("");
        setConfirm("");

        toast.success("Password changed. Your other devices have been signed out.");
      } catch (error) {
        logger.error("Password change failed", error);
        setError(error instanceof Error ? error.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [current, password, confirm],
  );

  return (
    <Card className="p-6">
      <h2 className="text-foreground text-base font-semibold">Password</h2>

      <p className="text-muted-foreground mt-1 text-sm">
        Choose a new password. Every other device you are signed in on is signed out.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="current-password">Current password</Label>

          <Input
            id="current-password"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

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

        <Button type="submit" disabled={loading} className="w-full sm:w-auto sm:self-start">
          {loading ? "Changing..." : "Change password"}
        </Button>
      </form>
    </Card>
  );
};

export default ChangePasswordForm;
