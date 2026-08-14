import Link from "next/link";

import AcceptInvitationActions from "@/components/accept-invitation-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/dal";
import { invitationRepository } from "@/lib/repositories/invitation.repository";
import { maskEmail } from "@/lib/utils";

interface AcceptInvitationPageProps {
  params: Promise<{ id: string }>;
}

const Shell = ({ children }: { children: React.ReactNode }) => (
  <main className="bg-background flex min-h-svh items-center justify-center px-4">
    <Card className="w-full max-w-md p-6">{children}</Card>
  </main>
);

/**
 * Landing page for an invitation link.
 *
 * The invitation is read directly rather than through better-auth's
 * `getInvitation`, which requires a session whose email already matches — that
 * cannot render the "you need to sign up first" case, which is the common one.
 *
 * Nothing here is a security boundary: the address is masked, and accepting is
 * still gated on a matching signed-in email by better-auth.
 */
const AcceptInvitationPage = async ({ params }: AcceptInvitationPageProps) => {
  const { id } = await params;

  const [invitation, currentUser] = await Promise.all([
    invitationRepository.findByIdWithContext(id),
    getCurrentUser(),
  ]);

  if (!invitation) {
    return (
      <Shell>
        <h1 className="text-foreground text-xl font-semibold tracking-tight">
          This invitation does not exist
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          The link may have been mistyped, or the invitation was withdrawn.
        </p>
        <Button className="mt-4" nativeButton={false} render={<Link href="/" />}>
          Go to FinanceFlow
        </Button>
      </Shell>
    );
  }

  const isExpired = invitation.expiresAt < new Date();
  const isPending = invitation.status === "pending";

  if (!isPending || isExpired) {
    return (
      <Shell>
        <h1 className="text-foreground text-xl font-semibold tracking-tight">
          {invitation.status === "accepted"
            ? "This invitation was already used"
            : "This invitation is no longer valid"}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {invitation.status === "accepted"
            ? `You may already be a member of ${invitation.spaceName}. Sign in to check.`
            : `Ask ${invitation.inviterName ?? "whoever invited you"} to send a new one.`}
        </p>
        <Button className="mt-4" nativeButton={false} render={<Link href="/sign-in" />}>
          Sign in
        </Button>
      </Shell>
    );
  }

  const invitedBy = invitation.inviterName ?? "Someone";

  // Not signed in — they need an account on the invited address first.
  if (!currentUser) {
    return (
      <Shell>
        <h1 className="text-foreground text-xl font-semibold tracking-tight">
          {invitedBy} invited you to {invitation.spaceName}
        </h1>

        <p className="text-muted-foreground mt-2 text-sm">
          A shared space for tracking joint expenses together. Your own ledger stays private.
        </p>

        <p className="text-muted-foreground mt-4 text-sm">
          The invitation is for{" "}
          <span className="text-foreground">{maskEmail(invitation.email)}</span>. Create an account
          with that address, or sign in if you already have one.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <Button
            nativeButton={false}
            render={
              <Link href={`/sign-up?redirect=${encodeURIComponent(`/accept-invitation/${id}`)}`} />
            }
          >
            Create an account
          </Button>

          <Button
            variant="outline"
            nativeButton={false}
            render={
              <Link href={`/sign-in?redirect=${encodeURIComponent(`/accept-invitation/${id}`)}`} />
            }
          >
            I already have an account
          </Button>
        </div>
      </Shell>
    );
  }

  // Signed in as somebody else.
  if (currentUser.email.toLowerCase() !== invitation.email.toLowerCase()) {
    return (
      <Shell>
        <h1 className="text-foreground text-xl font-semibold tracking-tight">
          This invitation is for a different account
        </h1>

        <p className="text-muted-foreground mt-2 text-sm">
          It was sent to <span className="text-foreground">{maskEmail(invitation.email)}</span>, but
          you are signed in as <span className="text-foreground">{currentUser.email}</span>.
        </p>

        <p className="text-muted-foreground mt-4 text-sm">
          Sign out and sign back in with the invited address to accept it.
        </p>

        <Button className="mt-6" variant="outline" nativeButton={false} render={<Link href="/" />}>
          Back to FinanceFlow
        </Button>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-foreground text-xl font-semibold tracking-tight">
        {invitedBy} invited you to {invitation.spaceName}
      </h1>

      <p className="text-muted-foreground mt-2 text-sm">
        Joining lets you add and edit entries in this shared space. Everyone in it can do the same.
        Your personal ledger stays private.
      </p>

      <AcceptInvitationActions invitationId={id} spaceName={invitation.spaceName} />
    </Shell>
  );
};

export default AcceptInvitationPage;
