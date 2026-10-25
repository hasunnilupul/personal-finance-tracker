import Link from "next/link";

import AuthCard from "@/components/auth-card";
import ResetPasswordForm from "@/components/reset-password-form";
import { buttonVariants } from "@/components/ui/button";

interface ResetPasswordPageProps {
  searchParams: Promise<{ token?: string; error?: string }>;
}

/**
 * Where the emailed link lands.
 *
 * better-auth validates the token on its way here and sends an unusable one with
 * `?error=INVALID_TOKEN` instead of `?token=`. Either way the form is only
 * offered with a token in hand; the token is checked again, and consumed, when
 * the new password is submitted.
 */
const ResetPasswordPage = async ({ searchParams }: ResetPasswordPageProps) => {
  const { token, error } = await searchParams;

  if (!token || error) {
    return (
      <AuthCard
        title="This link has expired"
        description="Reset links work once, for an hour. Ask for a fresh one and try again."
      >
        <Link href="/forgot-password" className={buttonVariants({ className: "w-full" })}>
          Send a new link
        </Link>
      </AuthCard>
    );
  }

  return <ResetPasswordForm token={token} />;
};

export default ResetPasswordPage;
