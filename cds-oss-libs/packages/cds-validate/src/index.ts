// ─── Public API ──────────────────────────────────────────────────────────────
// Re-exports everything the consumer needs. Keep this file to 5–10 lines.

export { validate, validateQuery, validateParams } from './validator';
export { mapZodError } from './error-mapper';
export { schemaFromEntity, cdsTypeToZod } from './schema-builder';

// ─── Type exports ────────────────────────────────────────────────────────────

export type {
  CAPRequest,
  CAPError,
  CAPErrorDetail,
  ValidationOptions,
  CAPHandler,
  ValidateSchema,
} from './types';

export type {
  CDSElement,
  CDSEntity,
  CDSModel,
  SchemaFromEntityOptions,
} from './schema-builder';
