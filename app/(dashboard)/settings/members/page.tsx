import Link from "next/link";

import MembersManager from "@/components/members-manager";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireActiveSpace } from "@/lib/auth/dal";
import { roleHasPermission } from "@/lib/auth/permissions";
import { isEmailConfigured } from "@/lib/email/client";
import { spaceService } from "@/lib/services/space.service";

const MembersPage = async () => {
  const { space, role, ctx } = await requireActiveSpace();

  // The personal space is private by definition, so there is nothing to manage.
  if (space.isPersonal) {
    return (
      <Card className="mx-auto w-full max-w-lg p-6">
        <h1 className="text-foreground text-xl font-semibold tracking-tight">
          Your personal space is private
        </h1>

        <p className="text-muted-foreground mt-2 text-sm">
          Nobody else can ever see it. To track joint expenses with family, create a shared space
          and invite them there.
        </p>

        <Button className="mt-4" nativeButton={false} render={<Link href="/spaces/new" />}>
          Create a shared space
        </Button>
      </Card>
    );
  }

  const [members, invitations] = await Promise.all([
    spaceService.listMembersWithUser(space.id),
    spaceService.listPendingInvitations(space.id),
  ]);

  const canInvite = roleHasPermission(role, { invitation: ["create"] });

  return (
    <MembersManager
      spaceName={space.name}
      members={members}
      invitations={invitations}
      currentUserId={ctx.userId}
      canInvite={canInvite}
      emailConfigured={isEmailConfigured()}
    />
  );
};

export default MembersPage;
