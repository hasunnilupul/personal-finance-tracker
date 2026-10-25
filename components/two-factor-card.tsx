"use client";

import { FormEvent, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, CopyIcon, ShieldCheckIcon } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { twoFactor } from "@/lib/auth/auth-client";
import {
  groupSecret,
  isTotpCode,
  normaliseTotpCode,
  secretFromTotpUri,
  TOTP_CODE_LENGTH,
} from "@/lib/auth/two-factor-input";
import { logger } from "@/lib/logger";

interface TwoFactorCardProps {
  /** Server-side truth, read from the session. */
  enabled: boolean;
}

type PasswordAction = "enable" | "disable" | "regenerate";

type Step =
  | { kind: "idle" }
  | { kind: "password"; action: PasswordAction }
  /** Secret issued, not yet proven. Nothing is switched on until the code is right. */
  | { kind: "scan"; totpUri: string; backupCodes: string[] }
  | { kind: "codes"; backupCodes: string[]; heading: string };

const PASSWORD_PROMPTS: Record<PasswordAction, { title: string; submit: string; busy: string }> = {
  enable: {
    title: "Confirm your password to start",
    submit: "Continue",
    busy: "Please wait...",
  },
  disable: {
    title: "Confirm your password to turn two-step verification off",
    submit: "Turn off",
    busy: "Turning off...",
  },
  regenerate: {
    title: "Confirm your password to get new backup codes",
    submit: "Get new codes",
    busy: "Please wait...",
  },
};

/**
 * Optional two-step verification, with an authenticator app.
 *
 * **Turning it on is two steps, and the second is what switches it on.** Asking
 * for a secret only issues one; the account is not asked for a code at sign-in
 * until a code from the app has been typed back and checked. Otherwise a person
 * who scanned the wrong thing, or closed the tab, would be locked out of an
 * account they had only started to protect.
 *
 * Every action that weakens or replaces the second factor asks for the password
 * again, so a session left open on someone else's screen cannot quietly turn it
 * off.
 */
const TwoFactorCard = ({ enabled }: TwoFactorCardProps) => {
  const router = useRouter();

  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const reset = useCallback(() => {
    setStep({ kind: "idle" });
    setPassword("");
    setCode("");
    setError(null);
  }, []);

  const handlePassword = useCallback(
    async (e: FormEvent<HTMLFormElement>, action: PasswordAction) => {
      e.preventDefault();

      setError(null);
      setLoading(true);

      try {
        if (action === "enable") {
          const { data, error } = await twoFactor.enable({ password });

          if (error || !data) {
            throw new Error(error?.message ?? "Could not start setup");
          }

          setStep({ kind: "scan", totpUri: data.totpURI, backupCodes: data.backupCodes });
        } else if (action === "regenerate") {
          const { data, error } = await twoFactor.generateBackupCodes({ password });

          if (error || !data) {
            throw new Error(error?.message ?? "Could not make new codes");
          }

          setStep({
            kind: "codes",
            backupCodes: data.backupCodes,
            heading: "Your new backup codes",
          });
        } else {
          const { error } = await twoFactor.disable({ password });

          if (error) {
            throw new Error(error.message);
          }

          toast.success("Two-step verification is off.");
          reset();
          router.refresh();
        }

        setPassword("");
      } catch (error) {
        logger.error("Two-factor password step failed", error, { action });
        setError(error instanceof Error ? error.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [password, reset, router],
  );

  const handleVerify = useCallback(
    async (e: FormEvent<HTMLFormElement>, backupCodes: string[]) => {
      e.preventDefault();

      if (!isTotpCode(code)) {
        setError(`Enter the ${TOTP_CODE_LENGTH}-digit code from your authenticator app.`);

        return;
      }

      setError(null);
      setLoading(true);

      try {
        const { error } = await twoFactor.verifyTotp({ code: normaliseTotpCode(code) });

        if (error) {
          throw new Error(error.message);
        }

        // On from here. The codes are shown now rather than at the scan step so
        // they are the last thing on screen when setup is finished, not
        // something scrolled past on the way to the code box.
        setCode("");
        setStep({ kind: "codes", backupCodes, heading: "Save your backup codes" });
        router.refresh();
      } catch (error) {
        logger.error("Two-factor verification failed", error);
        setError(error instanceof Error ? error.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [code, router],
  );

  const copyCodes = useCallback(async (backupCodes: string[]) => {
    try {
      await navigator.clipboard.writeText(backupCodes.join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy. Select the codes and copy them by hand.");
    }
  }, []);

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-foreground text-base font-semibold">Two-step verification</h2>

          <p className="text-muted-foreground mt-1 text-sm">
            Ask for a code from an authenticator app when you sign in, on top of your password.
            Optional.
          </p>
        </div>

        {enabled && step.kind === "idle" && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <ShieldCheckIcon className="size-3.5" />
            On
          </span>
        )}
      </div>

      {step.kind === "idle" && !enabled && (
        <Button
          className="mt-4 w-full sm:w-auto"
          onClick={() => setStep({ kind: "password", action: "enable" })}
        >
          Turn on
        </Button>
      )}

      {step.kind === "idle" && enabled && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => setStep({ kind: "password", action: "regenerate" })}
          >
            New backup codes
          </Button>

          <Button
            variant="outline"
            onClick={() => setStep({ kind: "password", action: "disable" })}
          >
            Turn off
          </Button>
        </div>
      )}

      {step.kind === "password" && (
        <form onSubmit={(e) => handlePassword(e, step.action)} className="mt-4 flex flex-col gap-3">
          <Label htmlFor="two-factor-password">{PASSWORD_PROMPTS[step.action].title}</Label>

          <Input
            id="two-factor-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
            required
          />

          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? PASSWORD_PROMPTS[step.action].busy : PASSWORD_PROMPTS[step.action].submit}
            </Button>

            <Button type="button" variant="ghost" onClick={reset} disabled={loading}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {step.kind === "scan" && (
        <form
          onSubmit={(e) => handleVerify(e, step.backupCodes)}
          className="mt-4 flex flex-col gap-4"
        >
          <p className="text-sm">
            Scan this with an authenticator app (Google Authenticator, Authy, 1Password and the
            like), then type the 6-digit code it shows.
          </p>

          <div className="flex justify-center">
            {/* White behind the code whatever the theme: a QR needs the contrast to scan. */}
            <div className="rounded-xl bg-white p-3">
              <QRCodeSVG value={step.totpUri} size={168} title="Authenticator setup code" />
            </div>
          </div>

          <SetupKey totpUri={step.totpUri} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="two-factor-setup-code">Code from the app</Label>

            <Input
              id="two-factor-setup-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="one-time-code"
              inputMode="numeric"
              required
            />
          </div>

          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Checking..." : "Turn on"}
            </Button>

            <Button type="button" variant="ghost" onClick={reset} disabled={loading}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {step.kind === "codes" && (
        <div className="mt-4 flex flex-col gap-4">
          <p className="text-foreground text-sm font-medium">{step.heading}</p>

          <p className="text-muted-foreground text-sm">
            If you lose your phone, each of these gets you in once. They are shown only now — keep
            them somewhere other than this phone.
          </p>

          <ul
            aria-label="Backup codes"
            className="bg-muted/50 grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl p-3 font-mono text-sm"
          >
            {step.backupCodes.map((backupCode) => (
              <li key={backupCode}>{backupCode}</li>
            ))}
          </ul>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => copyCodes(step.backupCodes)}>
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? "Copied" : "Copy"}
            </Button>

            <Button onClick={reset}>I have saved them</Button>
          </div>
        </div>
      )}
    </Card>
  );
};

/**
 * The secret as text, for when the camera is the thing being used to read this
 * page — a phone cannot scan its own screen.
 */
const SetupKey = ({ totpUri }: { totpUri: string }) => {
  const secret = secretFromTotpUri(totpUri);

  if (!secret) {
    return null;
  }

  return (
    <div className="text-sm">
      <p className="text-muted-foreground">Can&rsquo;t scan? Enter this key instead:</p>

      <p
        data-testid="two-factor-setup-key"
        className="bg-muted/50 mt-1 rounded-xl p-3 font-mono tracking-wider break-all select-all"
      >
        {groupSecret(secret)}
      </p>

      <a
        href={totpUri}
        className="text-foreground mt-2 inline-block font-medium underline-offset-4 hover:underline"
      >
        Open in an authenticator app on this device
      </a>
    </div>
  );
};

export default TwoFactorCard;
