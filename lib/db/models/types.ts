/**
 * Columns the caller never supplies.
 *
 * The service layer fills these from the {@link SpaceContext}, which is
 * derived from the session — so a client cannot write a row into someone
 * else's space or forge attribution by posting extra fields.
 */
export type ManagedFields =
  "id" | "organizationId" | "createdBy" | "updatedBy" | "createdAt" | "updatedAt";

/**
 * The writable shape of an entity, as accepted by services.
 */
export type UserInput<TInsert> = Omit<TInsert, ManagedFields>;
