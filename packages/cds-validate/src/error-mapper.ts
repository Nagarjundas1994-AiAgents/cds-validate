import { ZodError, ZodIssue } from 'zod';
import { CAPError, CAPErrorDetail } from './types';

/**
 * HTTP status code used for all validation failures.
 * 422 Unprocessable Entity is the correct OData/REST status for
 * "I understood your request, but the data is semantically invalid."
 */
const VALIDATION_STATUS_CODE = 422;

/**
 * Converts a single Zod issue into an OData-compatible error detail.
 *
 * The `target` field is built by joining the Zod error path array with
 * forward slashes. This is already valid OData target syntax:
 *   ['address', 'zipCode']  →  'address/zipCode'
 *   ['email']               →  'email'
 *   []                      →  '' (root-level error)
 */
function mapIssueToDetail(issue: ZodIssue): CAPErrorDetail {
  return {
    message: issue.message,
    target: issue.path.join('/'),
  };
}

/**
 * Converts a full ZodError into a CAP OData-compatible error object.
 *
 * The output shape matches what CAP's `req.error()` expects, so the
 * error flows through the standard CAP error handling pipeline and
 * arrives at the client as a proper OData error response.
 *
 * @param zodError - The ZodError from a failed `safeParse()` call.
 * @returns A structured CAPError with code 422, a summary message,
 *          and a details array with one entry per field-level error.
 *
 * @example
 * ```ts
 * const result = schema.safeParse(req.data);
 * if (!result.success) {
 *   const capError = mapZodError(result.error);
 *   req.error(capError);
 * }
 * ```
 */
export function mapZodError(zodError: ZodError): CAPError {
  const issues = zodError.issues;
  const details: CAPErrorDetail[] = issues.map(mapIssueToDetail);

  // Use the first error's target as the top-level target for convenience.
  // Multi-field errors are fully described in the details array.
  const primaryTarget = details.length > 0 ? details[0].target : undefined;

  return {
    code: VALIDATION_STATUS_CODE,
    message:
      issues.length === 1
        ? issues[0].message
        : `Validation failed with ${issues.length} errors`,
    target: primaryTarget,
    details,
  };
}
