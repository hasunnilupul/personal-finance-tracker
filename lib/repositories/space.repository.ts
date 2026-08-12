import { and, asc, desc, eq, getTableColumns } from "drizzle-orm";

import { db } from "@/lib/db";
import { organization, member } from "@/lib/db/schema/organization";
import { user } from "@/lib/db/schema/better-auth";
import {
  Member,
  NewMember,
  NewOrganization,
  Organization,
  Space,
  SpaceMember,
} from "@/lib/db/models/organization.model";

export class SpaceRepository {
  async create(data: NewOrganization): Promise<Organization> {
    const [result] = await db.insert(organization).values(data).returning();
    return result;
  }

  async findById(id: string): Promise<Organization | undefined> {
    const [result] = await db.select().from(organization).where(eq(organization.id, id));
    return result;
  }

  async addMember(data: NewMember): Promise<Member> {
    const [result] = await db.insert(member).values(data).returning();
    return result;
  }

  /**
   * The caller's membership in a space, or `undefined` if they are not in it.
   *
   * This is the authorization lookup — it answers both "may I see this space?"
   * and "with what role?".
   */
  async findMembership(userId: string, organizationId: string): Promise<Member | undefined> {
    const [result] = await db
      .select()
      .from(member)
      .where(and(eq(member.userId, userId), eq(member.organizationId, organizationId)));
    return result;
  }

  /**
   * Every space the user belongs to, personal space first, then alphabetical.
   */
  async listForUser(userId: string): Promise<Space[]> {
    return db
      .select({
        ...getTableColumns(organization),
        role: member.role,
      })
      .from(member)
      .innerJoin(organization, eq(member.organizationId, organization.id))
      .where(eq(member.userId, userId))
      .orderBy(desc(organization.isPersonal), asc(organization.name));
  }

  /**
   * The user's own private ledger, created for them at sign-up.
   */
  async findPersonalSpace(userId: string): Promise<Organization | undefined> {
    const [result] = await db
      .select(getTableColumns(organization))
      .from(member)
      .innerJoin(organization, eq(member.organizationId, organization.id))
      .where(and(eq(member.userId, userId), eq(organization.isPersonal, true)));
    return result;
  }

  async listMembers(organizationId: string): Promise<Member[]> {
    return db
      .select()
      .from(member)
      .where(eq(member.organizationId, organizationId))
      .orderBy(asc(member.createdAt));
  }

  /**
   * Members of a space with the person behind each one, for the members page.
   */
  async listMembersWithUser(organizationId: string): Promise<SpaceMember[]> {
    return db
      .select({
        id: member.id,
        userId: member.userId,
        organizationId: member.organizationId,
        role: member.role,
        createdAt: member.createdAt,
        name: user.name,
        email: user.email,
        image: user.image,
      })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(eq(member.organizationId, organizationId))
      .orderBy(asc(member.createdAt));
  }
}

export const spaceRepository = new SpaceRepository();
