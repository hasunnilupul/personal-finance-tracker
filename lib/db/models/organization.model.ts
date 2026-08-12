import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { organization, member, invitation } from "@/lib/db/schema/organization";

export type Organization = InferSelectModel<typeof organization>;
export type NewOrganization = InferInsertModel<typeof organization>;

export type Member = InferSelectModel<typeof member>;
export type NewMember = InferInsertModel<typeof member>;

export type Invitation = InferSelectModel<typeof invitation>;
export type NewInvitation = InferInsertModel<typeof invitation>;

/**
 * A space as the UI needs it: the organization plus the caller's role in it.
 */
export type Space = Organization & {
  role: string;
};

/**
 * A membership joined to the person behind it, for the members list.
 */
export interface SpaceMember {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
  createdAt: Date;
  name: string;
  email: string;
  image: string | null;
}
