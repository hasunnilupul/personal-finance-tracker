/**
 * Columns the caller never supplies.
 *
 * The service layer fills these from the {@link SpaceContext}, which is
 * derived from the session — so a client cannot write a row into someone
 * else's space or forge attribution by posting extra fields.
 */
export type ManagedFields =
  | "id"
  | "organizationId"
  | "createdBy"
  | "updatedBy"
  | "createdAt"
  | "updatedAt"
  // Derived by the service from `amount`, `currency` and the entry's date.
  // Accepting these from a caller would let a client claim any conversion.
  | "baseAmount"
  | "exchangeRate";

/**
 * The writable shape of an entity, as accepted by services.
 */
export type UserInput<TInsert> = Omit<TInsert, ManagedFields>;
