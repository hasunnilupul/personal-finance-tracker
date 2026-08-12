import { and, asc, eq, gt, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { invitation, organization } from "@/lib/db/schema/organization";
import { user } from "@/lib/db/schema/better-auth";
import { Invitation } from "@/lib/db/models/organization.model";

/**
 * An invitation with the context needed to show it on the accept page.
 */
export interface InvitationWithContext {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: Date;
  organizationId: string;
  spaceName: string;
  inviterName: string | null;
}

export class InvitationRepository {
  /**
   * Reads an invitation along with the space and inviter names.
   *
   * Used by the accept page, which has to render for signed-out visitors —
   * better-auth's own `getInvitation` requires a session whose email already
   * matches the invitation, so it cannot serve that screen.
   */
  async findByIdWithContext(id: string): Promise<InvitationWithContext | undefined> {
    const [result] = await db
      .select({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        organizationId: invitation.organizationId,
        spaceName: organization.name,
        inviterName: user.name,
      })
      .from(invitation)
      .innerJoin(organization, eq(invitation.organizationId, organization.id))
      .leftJoin(user, eq(invitation.inviterId, user.id))
      .where(eq(invitation.id, id));

    return result;
  }

  /**
   * Any pending, unexpired invitation for an email address.
   *
   * This is what makes sign-up invite-only: no pending invitation, no account.
   * Matched case-insensitively because email casing is not meaningful and
   * better-auth stores the address lowercased.
   */
  async findPendingByEmail(email: string): Promise<Invitation | undefined> {
    const [result] = await db
      .select()
      .from(invitation)
      .where(
        and(
          sql`lower(${invitation.email}) = ${email.toLowerCase()}`,
          eq(invitation.status, "pending"),
          gt(invitation.expiresAt, new Date()),
        ),
      );

    return result;
  }

  /**
   * Pending invitations for a space, for the members page.
   */
  async listPending(organizationId: string): Promise<Invitation[]> {
    return db
      .select()
      .from(invitation)
      .where(
        and(
          eq(invitation.organizationId, organizationId),
          eq(invitation.status, "pending"),
          gt(invitation.expiresAt, new Date()),
        ),
      )
      .orderBy(asc(invitation.createdAt));
  }
}

export const invitationRepository = new InvitationRepository();
