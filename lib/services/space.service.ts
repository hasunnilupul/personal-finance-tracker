import { spaceRepository } from "@/lib/repositories/space.repository";
import { categoryService } from "@/lib/services/category.service";
import { Member, Organization, Space } from "@/lib/db/models/organization.model";
import { ServiceError } from "@/lib/services/errors";
import { logger } from "@/lib/logger";

/**
 * Builds a URL-safe slug, suffixed to stay unique across all spaces.
 */
export function toSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  const suffix = crypto.randomUUID().slice(0, 8);

  return base ? `${base}-${suffix}` : suffix;
}

export class SpaceService {
  /**
   * Creates the private ledger a user gets at sign-up, and seeds it with the
   * default categories.
   *
   * Written directly rather than through better-auth's `createOrganization`
   * endpoint because it runs inside a database hook, before the user has a
   * session to authorise that call with.
   */
  async createPersonalSpace(user: { id: string; name?: string | null }): Promise<Organization> {
    const space = await spaceRepository.create({
      id: crypto.randomUUID(),
      name: "Personal",
      slug: toSlug(`personal-${user.name ?? user.id}`),
      isPersonal: true,
    });

    await spaceRepository.addMember({
      id: crypto.randomUUID(),
      organizationId: space.id,
      userId: user.id,
      role: "owner",
    });

    await categoryService.seedDefaultCategories({
      organizationId: space.id,
      userId: user.id,
    });

    logger.info("Personal space created", { userId: user.id, organizationId: space.id });

    return space;
  }

  async listSpaces(userId: string): Promise<Space[]> {
    return spaceRepository.listForUser(userId);
  }

  async getPersonalSpace(userId: string): Promise<Organization | undefined> {
    return spaceRepository.findPersonalSpace(userId);
  }

  async getMembership(userId: string, organizationId: string): Promise<Member | undefined> {
    return spaceRepository.findMembership(userId, organizationId);
  }

  async listMembers(organizationId: string): Promise<Member[]> {
    return spaceRepository.listMembers(organizationId);
  }

  /**
   * Resolves which space a request should act on.
   *
   * Prefers the session's active space, but only after confirming the user is
   * still a member of it — a stale or tampered `activeOrganizationId` must
   * never grant access. Falls back to the personal space.
   *
   * @throws {ServiceError} `SPACE_NOT_FOUND` if the user has no space at all,
   * which would mean the sign-up hook failed.
   */
  async resolveActiveSpace(
    userId: string,
    activeOrganizationId?: string | null,
  ): Promise<{ space: Organization; role: string }> {
    if (activeOrganizationId) {
      const membership = await spaceRepository.findMembership(userId, activeOrganizationId);

      if (membership) {
        const space = await spaceRepository.findById(activeOrganizationId);

        if (space) {
          return { space, role: membership.role };
        }
      }

      logger.warn("Active space is not accessible, falling back to personal", {
        userId,
        activeOrganizationId,
      });
    }

    const personal = await this.getPersonalSpace(userId);

    if (!personal) {
      throw new ServiceError(
        "SPACE_NOT_FOUND",
        "Your personal space is missing. Please sign out and back in.",
      );
    }

    return { space: personal, role: "owner" };
  }
}

export const spaceService = new SpaceService();
