/**
 * Who is acting, and in which space.
 *
 * Every service call takes one of these. `organizationId` scopes the query —
 * it is resolved from the session by `requireActiveSpace()`, never from user
 * input — and `userId` is recorded as `createdBy` / `updatedBy` so shared
 * spaces can show who touched what.
 *
 * `baseCurrency` travels with them because converting an entry is part of
 * writing it, and the service should not have to re-read the space to find out
 * what to convert into.
 */
export interface SpaceContext {
  organizationId: string;
  userId: string;
  baseCurrency: string;
}
