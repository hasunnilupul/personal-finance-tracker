"use client";

import { FormEvent, useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import AuthCard from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { twoFactor } from "@/lib/auth/auth-client";
import {
  isTotpCode,
  normaliseBackupCode,
  normaliseTotpCode,
  TOTP_CODE_LENGTH,
} from "@/lib/auth/two-factor-input";
import { logger } from "@/lib/logger";
import { purgePrivateCaches } from "@/lib/pwa/private-cache";

interface TwoFactorChallengeProps {
  /** In-app path to land on once verified. Already sanitised by the page. */
  redirectTo: string;
  /** Back to the password step, for a challenge that has timed out or been given up on. */
  onStartOver: () => void;
}

/**
 * The second step of signing in, for an account that has turned two-factor on.
 *
 * The password has already been accepted by the time this shows, but there is no
 * session yet — the server holds a short-lived, signed cookie that says only
 * "this browser got the password right". Closing the tab or waiting ten minutes
 * ends it, and "Start over" is how a person gets out of an expired one.
 *
 * **"Trust this device" is off unless asked for.** It skips this step for thirty
 * days on this browser, which is the right trade on a phone that is only ever
 * yours and the wrong one on a shared computer. Defaulting it on would make that
 * choice for everyone.
 */
const TwoFactorChallenge = ({ redirectTo, onStartOver }: TwoFactorChallengeProps) => {
  const router = useRouter();

  const [useBackup, setUseBackup] = useState(false);
  const [code, setCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      if (!useBackup && !isTotpCode(code)) {
        setError(`Enter the ${TOTP_CODE_LENGTH}-digit code from your authenticator app.`);

        return;
      }

      setError(null);
      setLoading(true);

      try {
        const { error } = useBackup
          ? await twoFactor.verifyBackupCode({ code: normaliseBackupCode(code), trustDevice })
          : await twoFactor.verifyTotp({ code: normaliseTotpCode(code), trustDevice });

        if (error) {
          throw new Error(error.message);
        }

        // As after a one-step sign-in: whatever the last session cached goes now.
        await purgePrivateCaches();

        router.push(redirectTo);
        router.refresh();
      } catch (error) {
        logger.error("Two-factor verification failed", error);
        setError(error instanceof Error ? error.message : "Something went wrong");
        setLoading(false);
      }
    },
    [useBackup, code, trustDevice, redirectTo, router],
  );

  return (
    <AuthCard
      title="Two-step verification"
      description={
        useBackup
          ? "Enter one of the backup codes you saved when you turned this on. Each works once."
          : "Enter the 6-digit code from your authenticator app."
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="two-factor-code">
            {useBackup ? "Backup code" : "Authentication code"}
          </Label>

          <Input
            id="two-factor-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            // `one-time-code` is what lets a phone offer the code from a
            // password manager or a message; `numeric` is the right keyboard.
            autoComplete="one-time-code"
            inputMode={useBackup ? "text" : "numeric"}
            autoFocus
            required
          />
        </div>

        <label className="text-muted-foreground flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={trustDevice}
            onChange={(e) => setTrustDevice(e.target.checked)}
            className="size-4"
          />
          Trust this device for 30 days
        </label>

        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Please wait..." : "Verify"}
        </Button>
      </form>

      <div className="mt-6 flex flex-col items-center gap-2 text-sm">
        <button
          type="button"
          onClick={() => {
            setUseBackup((value) => !value);
            setCode("");
            setError(null);
          }}
          className="text-foreground font-medium underline-offset-4 hover:underline"
        >
          {useBackup ? "Use my authenticator app" : "Use a backup code"}
        </button>

        <button
          type="button"
          onClick={onStartOver}
          className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          Start over
        </button>
      </div>
    </AuthCard>
  );
};

export default TwoFactorChallenge;
