import { ZodObject, ZodRawShape, ZodSchema } from 'zod';
import { mapZodError } from './error-mapper';
import { CAPHandler, CAPRequest, ValidationOptions } from './types';

/** Default options applied when none are provided. */
const DEFAULT_OPTIONS: Required<ValidationOptions> = {
  strict: false,
  normalize: true,
};

/**
 * Detects whether the current CDS event is an UPDATE operation.
 * For UPDATE events we automatically call `schema.partial()` so that
 * missing fields are not flagged as errors (partial updates are valid).
 */
function isUpdateEvent(event: string): boolean {
  const normalized = event?.toUpperCase?.() ?? '';
  return normalized === 'UPDATE' || normalized === 'PATCH';
}

/**
 * If the schema is a ZodObject, wraps it with `.partial()` for UPDATE
 * events (so only the fields present in the payload are validated).
 * For non-ZodObject schemas we return as-is — the caller is responsible
 * for handling partials in that case.
 */
function maybePartial(schema: ZodSchema, event: string): ZodSchema {
  if (isUpdateEvent(event) && schema instanceof ZodObject) {
    return (schema as ZodObject<ZodRawShape>).partial();
  }
  return schema;
}

/**
 * Creates a CAP middleware that validates `req.data` against a Zod schema.
 *
 * This is a **higher-order function** (factory pattern):
 *   `validate(schema)` returns a handler function `(req, next) => ...`
 *
 * **Key behaviors:**
 * - On **CREATE**: validates all fields as defined in the schema.
 * - On **UPDATE**: automatically calls `schema.partial()` so only the
 *   fields present in the payload are validated.
 * - On success with `normalize: true`: overwrites `req.data` with the
 *   Zod-parsed result, giving you free type coercion and transforms.
 * - On failure: maps the ZodError to an OData error and calls `req.error()`.
 *
 * @param schema  - A Zod schema describing the expected shape of `req.data`.
 * @param options - Optional configuration for strict mode and normalization.
 * @returns A CAP-compatible handler function.
 *
 * @example
 * ```ts
 * const StudentSchema = z.object({
 *   name: z.string().min(1),
 *   email: z.string().email(),
 *   gpa: z.coerce.number().min(0).max(4),
 * });
 *
 * srv.before('CREATE', 'Students', validate(StudentSchema));
 * ```
 */
export function validate(
  schema: ZodSchema,
  options?: ValidationOptions
): CAPHandler {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return async (req: CAPRequest): Promise<void> => {
    // For UPDATE events, make all fields optional automatically.
    const effectiveSchema = maybePartial(schema, req.event);

    // Use safeParse so we never throw — we collect errors instead.
    const result = effectiveSchema.safeParse(req.data);

    if (!result.success) {
      const capError = mapZodError(result.error);
      req.error(capError);
      return;
    }

    // On success: optionally overwrite req.data with the parsed output.
    // This gives free type coercion (e.g. z.coerce.number() converts "3" → 3)
    // and transformations (e.g. z.string().trim() strips whitespace).
    if (opts.normalize) {
      req.data = result.data as Record<string, unknown>;
    }
  };
}

/**
 * Creates a CAP middleware that validates `req.query` against a Zod schema.
 * Use this to validate OData query parameters ($filter, $top, etc.).
 *
 * @param schema  - A Zod schema describing the expected query parameters.
 * @param options - Optional configuration.
 * @returns A CAP-compatible handler function.
 *
 * @example
 * ```ts
 * const QuerySchema = z.object({
 *   $top: z.coerce.number().max(100).optional(),
 *   $skip: z.coerce.number().min(0).optional(),
 * });
 *
 * srv.before('READ', 'Students', validateQuery(QuerySchema));
 * ```
 */
export function validateQuery(
  schema: ZodSchema,
  options?: ValidationOptions
): CAPHandler {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return async (req: CAPRequest): Promise<void> => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      const capError = mapZodError(result.error);
      req.error(capError);
      return;
    }

    if (opts.normalize) {
      req.query = result.data as Record<string, unknown>;
    }
  };
}

/**
 * Creates a CAP middleware that validates `req.params` against a Zod schema.
 * Use this to validate bound action/function parameters.
 *
 * @param schema  - A Zod schema describing the expected parameters.
 * @param options - Optional configuration.
 * @returns A CAP-compatible handler function.
 *
 * @example
 * ```ts
 * const EnrollParams = z.object({
 *   studentId: z.string().uuid(),
 *   courseId: z.string().uuid(),
 * });
 *
 * srv.before('enrollStudent', validateParams(EnrollParams));
 * ```
 */
export function validateParams(
  schema: ZodSchema,
  options?: ValidationOptions
): CAPHandler {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return async (req: CAPRequest): Promise<void> => {
    // req.params can be an array of key-value maps or a single object.
    // Normalize to a single object for validation.
    const paramsObj = Array.isArray(req.params)
      ? Object.assign({}, ...req.params)
      : req.params;

    const result = schema.safeParse(paramsObj);

    if (!result.success) {
      const capError = mapZodError(result.error);
      req.error(capError);
      return;
    }

    if (opts.normalize) {
      req.params = result.data as Record<string, unknown>;
    }
  };
}
