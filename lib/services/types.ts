/**
 * Who is acting, and in which space.
 *
 * Every service call takes one of these. `organizationId` scopes the query —
 * it is resolved from the session by `requireActiveSpace()`, never from user
 * input — and `userId` is recorded as `createdBy` / `updatedBy` so shared
 * spaces can show who touched what.
 */
export interface SpaceContext {
  organizationId: string;
  userId: string;
}
