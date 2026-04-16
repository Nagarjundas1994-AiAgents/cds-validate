import { z, ZodError } from 'zod';
import { mapZodError } from '../src/error-mapper';

// ─── Helper: run safeParse to get a real ZodError ────────────────────────────

function getZodError(schema: z.ZodSchema, data: unknown): ZodError {
  const result = schema.safeParse(data);
  if (result.success) {
    throw new Error('Expected safeParse to fail, but it succeeded');
  }
  return result.error;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('error-mapper — mapZodError()', () => {
  const StudentSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email format'),
    gpa: z.number().min(0).max(4),
  });

  it('returns code 422 for any validation failure', () => {
    const zodError = getZodError(StudentSchema, {});
    const capError = mapZodError(zodError);

    expect(capError.code).toBe(422);
  });

  it('maps a single missing field with correct target', () => {
    // Only 'email' is missing — name and gpa are valid
    const zodError = getZodError(
      StudentSchema,
      { name: 'Alice', gpa: 3.5 } // missing email
    );
    const capError = mapZodError(zodError);

    expect(capError.code).toBe(422);
    expect(capError.details).toHaveLength(1);
    expect(capError.details![0].target).toBe('email');
    expect(capError.details![0].message).toBeDefined();
    // Single error → top-level message should be the field error itself
    expect(capError.message).toBe(capError.details![0].message);
  });

  it('maps multiple errors into a details array', () => {
    // All three fields are wrong
    const zodError = getZodError(StudentSchema, {
      name: '',    // violates min(1)
      email: 'not-an-email',
      gpa: 'high', // wrong type
    });
    const capError = mapZodError(zodError);

    expect(capError.code).toBe(422);
    expect(capError.details!.length).toBeGreaterThanOrEqual(3);
    expect(capError.message).toContain('errors');
  });

  it('joins nested paths with forward slashes (OData format)', () => {
    const AddressSchema = z.object({
      address: z.object({
        zipCode: z.string().length(5, 'Zip must be 5 chars'),
      }),
    });

    const zodError = getZodError(AddressSchema, {
      address: { zipCode: '1' },
    });
    const capError = mapZodError(zodError);

    expect(capError.details![0].target).toBe('address/zipCode');
  });

  it('handles root-level errors (empty path)', () => {
    // A schema-level refinement that doesn't target a specific field
    const RootSchema = z
      .object({ start: z.number(), end: z.number() })
      .refine((data) => data.end > data.start, {
        message: 'end must be after start',
      });

    const zodError = getZodError(RootSchema, { start: 10, end: 5 });
    const capError = mapZodError(zodError);

    expect(capError.details![0].target).toBe('');
  });

  it('returns a summary message for exactly 1 error', () => {
    const zodError = getZodError(z.object({ x: z.string() }), { x: 123 });
    const capError = mapZodError(zodError);

    // Should be the actual Zod message, not a summary
    expect(capError.message).not.toContain('errors');
    expect(capError.message).toBeDefined();
  });

  it('returns a count summary message for multiple errors', () => {
    const zodError = getZodError(StudentSchema, {});
    const capError = mapZodError(zodError);
    const count = zodError.issues.length;

    expect(capError.message).toBe(
      `Validation failed with ${count} errors`
    );
  });

  it('sets primary target from the first detail entry', () => {
    const zodError = getZodError(StudentSchema, { name: 'Alice', gpa: 3.5 });
    const capError = mapZodError(zodError);

    expect(capError.target).toBe(capError.details![0].target);
  });
});
