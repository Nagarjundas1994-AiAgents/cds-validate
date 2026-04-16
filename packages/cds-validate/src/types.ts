import { ZodSchema } from 'zod';

// ─── Shape of the SAP CAP request object ────────────────────────────────────
// This mirrors the subset of `cds.Request` that our middleware needs.
// We define our own interface to avoid a hard runtime dependency on @sap/cds.

export interface CAPRequest {
  /** The request payload (body for CREATE/UPDATE, or entity data). */
  data: Record<string, unknown>;

  /** OData query parameters ($filter, $select, $orderby, etc.). */
  query: Record<string, unknown>;

  /** Bound action/function parameters. */
  params: Record<string, unknown>[] | Record<string, unknown>;

  /** The CDS event name: 'CREATE', 'READ', 'UPDATE', 'DELETE', or a custom action. */
  event: string;

  /**
   * Registers an error on the request. CAP collects these and returns
   * them as an OData error response after the handler completes.
   */
  error: (err: CAPError) => void;

  /**
   * Rejects the request immediately with the given error.
   * Unlike `error()`, this stops all further processing.
   */
  reject?: (code: number, message: string, args?: unknown[]) => void;
}

// ─── Validation options the developer can pass to validate() ─────────────────

export interface ValidationOptions {
  /**
   * When `true`, unknown keys in `req.data` that are not in the schema
   * will cause a validation failure (Zod `strict` mode).
   * @default false
   */
  strict?: boolean;

  /**
   * When `true`, overwrites `req.data` with the Zod-parsed output.
   * This gives you free type coercion (e.g. string "3" → number 3)
   * and transformations (e.g. `.trim()`, `.toLowerCase()`).
   * @default true
   */
  normalize?: boolean;
}

// ─── OData-compatible error object ───────────────────────────────────────────
// This matches the CAP OData error response shape so the error flows through
// the standard CAP error handling pipeline.

export interface CAPErrorDetail {
  /** Human-readable error message for this specific field. */
  message: string;

  /** OData target path, e.g. 'email' or 'address/zipCode'. */
  target: string;
}

export interface CAPError {
  /** HTTP status code — we use 422 (Unprocessable Entity) for validation. */
  code: number | string;

  /** Top-level error message summarizing the validation failure. */
  message: string;

  /** OData target path for single-field errors. */
  target?: string;

  /** Array of individual field-level errors. */
  details?: CAPErrorDetail[];
}

// ─── Handler signature returned by validate() ────────────────────────────────

export type CAPHandler = (
  req: CAPRequest,
  next?: () => Promise<unknown>
) => Promise<void | unknown>;

// ─── Schema input — we accept any Zod schema ────────────────────────────────

export type ValidateSchema = ZodSchema<Record<string, unknown>>;
