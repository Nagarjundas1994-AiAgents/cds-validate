import { z } from 'zod';
import { validate, validateQuery, validateParams } from '../src/validator';
import { CAPRequest, CAPError } from '../src/types';

// ─── Helper: create a mock CAPRequest ────────────────────────────────────────

function mockReq(overrides: Partial<CAPRequest> = {}): CAPRequest {
  return {
    data: {},
    query: {},
    params: {},
    event: 'CREATE',
    error: jest.fn(),
    ...overrides,
  };
}

// ─── Test schema matching the spec's "Students" example ──────────────────────

const StudentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().trim().email('Invalid email'),
  gpa: z.coerce.number().min(0).max(4),
});

// ─── validate() tests ────────────────────────────────────────────────────────

describe('validate() — core middleware', () => {
  it('passes valid data without calling req.error', async () => {
    const handler = validate(StudentSchema);
    const req = mockReq({
      data: { name: 'Alice', email: 'alice@example.com', gpa: 3.5 },
    });

    await handler(req);

    expect(req.error).not.toHaveBeenCalled();
  });

  it('sets req.data to parsed output (normalization on by default)', async () => {
    const handler = validate(StudentSchema);
    const req = mockReq({
      data: { name: 'Alice', email: '  alice@example.com  ', gpa: '3.5' },
    });

    await handler(req);

    expect(req.error).not.toHaveBeenCalled();
    // email should be trimmed (via z.string().trim())
    expect(req.data.email).toBe('alice@example.com');
    // gpa should be coerced from string to number (via z.coerce.number())
    expect(req.data.gpa).toBe(3.5);
    expect(typeof req.data.gpa).toBe('number');
  });

  it('does NOT overwrite req.data when normalize is false', async () => {
    const handler = validate(StudentSchema, { normalize: false });
    const originalData = { name: 'Alice', email: '  alice@example.com  ', gpa: '3.5' };
    const req = mockReq({ data: { ...originalData } });

    await handler(req);

    expect(req.error).not.toHaveBeenCalled();
    // Original data should remain untouched — email still has whitespace
    // because normalize:false skips the req.data overwrite
    expect(req.data.email).toBe('  alice@example.com  ');
    // gpa should still be the original string, not coerced to number
    expect(req.data.gpa).toBe('3.5');
  });

  it('calls req.error for a missing required field', async () => {
    const handler = validate(StudentSchema);
    const req = mockReq({
      data: { name: 'Alice', gpa: 3.5 }, // missing email
    });

    await handler(req);

    expect(req.error).toHaveBeenCalledTimes(1);
    const errorArg = (req.error as jest.Mock).mock.calls[0][0] as CAPError;
    expect(errorArg.code).toBe(422);
    expect(errorArg.details).toHaveLength(1);
    expect(errorArg.details![0].target).toBe('email');
  });

  it('calls req.error for wrong type (string for GPA)', async () => {
    const handler = validate(StudentSchema);
    const req = mockReq({
      data: { name: 'Alice', email: 'alice@example.com', gpa: 'not-a-number' },
    });

    await handler(req);

    // z.coerce.number() will try to convert — 'not-a-number' becomes NaN
    // which then fails the min(0) check. So req.error IS called.
    expect(req.error).toHaveBeenCalledTimes(1);
  });

  it('reports multiple errors when 3 fields are invalid', async () => {
    const handler = validate(StudentSchema);
    const req = mockReq({
      data: { name: '', email: 'bad', gpa: -1 },
    });

    await handler(req);

    expect(req.error).toHaveBeenCalledTimes(1);
    const errorArg = (req.error as jest.Mock).mock.calls[0][0] as CAPError;
    expect(errorArg.details!.length).toBeGreaterThanOrEqual(3);
  });

  // ─── UPDATE partial behavior ──────────────────────────────────────────────

  it('allows partial data on UPDATE events (schema.partial())', async () => {
    const handler = validate(StudentSchema);
    const req = mockReq({
      event: 'UPDATE',
      data: { name: 'Bob' }, // only updating name — email & gpa omitted
    });

    await handler(req);

    expect(req.error).not.toHaveBeenCalled();
    expect(req.data.name).toBe('Bob');
  });

  it('still validates provided fields on UPDATE', async () => {
    const handler = validate(StudentSchema);
    const req = mockReq({
      event: 'UPDATE',
      data: { email: 'not-an-email' }, // partial but invalid
    });

    await handler(req);

    expect(req.error).toHaveBeenCalledTimes(1);
    const errorArg = (req.error as jest.Mock).mock.calls[0][0] as CAPError;
    expect(errorArg.details![0].target).toBe('email');
  });

  it('applies partial for PATCH events too', async () => {
    const handler = validate(StudentSchema);
    const req = mockReq({
      event: 'PATCH',
      data: { gpa: 3.9 },
    });

    await handler(req);
    expect(req.error).not.toHaveBeenCalled();
  });

  it('does NOT apply partial on CREATE events', async () => {
    const handler = validate(StudentSchema);
    const req = mockReq({
      event: 'CREATE',
      data: { name: 'Alice' }, // missing email and gpa
    });

    await handler(req);

    expect(req.error).toHaveBeenCalledTimes(1);
    const errorArg = (req.error as jest.Mock).mock.calls[0][0] as CAPError;
    expect(errorArg.details!.length).toBeGreaterThanOrEqual(1);
  });

  // ─── Data normalization (trim) ────────────────────────────────────────────

  it('normalizes data — trims email whitespace', async () => {
    const handler = validate(StudentSchema);
    const req = mockReq({
      data: { name: 'Alice', email: '  alice@example.com  ', gpa: 3.5 },
    });

    await handler(req);

    expect(req.error).not.toHaveBeenCalled();
    expect(req.data.email).toBe('alice@example.com');
  });
});

// ─── validateQuery() tests ───────────────────────────────────────────────────

describe('validateQuery() — query parameter validation', () => {
  const QuerySchema = z.object({
    $top: z.coerce.number().max(100).optional(),
    $skip: z.coerce.number().min(0).optional(),
  });

  it('passes valid query parameters', async () => {
    const handler = validateQuery(QuerySchema);
    const req = mockReq({ query: { $top: '10', $skip: '0' } });

    await handler(req);

    expect(req.error).not.toHaveBeenCalled();
    expect(req.query.$top).toBe(10); // coerced from string
  });

  it('rejects invalid query parameters', async () => {
    const handler = validateQuery(QuerySchema);
    const req = mockReq({ query: { $top: '999' } }); // exceeds max 100

    await handler(req);

    expect(req.error).toHaveBeenCalledTimes(1);
  });
});

// ─── validateParams() tests ──────────────────────────────────────────────────

describe('validateParams() — action parameter validation', () => {
  const EnrollSchema = z.object({
    studentId: z.string().uuid(),
    courseId: z.string().uuid(),
  });

  it('passes valid action parameters (object form)', async () => {
    const handler = validateParams(EnrollSchema);
    const req = mockReq({
      params: {
        studentId: '550e8400-e29b-41d4-a716-446655440000',
        courseId: '660e8400-e29b-41d4-a716-446655440001',
      },
    });

    await handler(req);

    expect(req.error).not.toHaveBeenCalled();
  });

  it('passes valid action parameters (array form)', async () => {
    const handler = validateParams(EnrollSchema);
    const req = mockReq({
      params: [
        { studentId: '550e8400-e29b-41d4-a716-446655440000' },
        { courseId: '660e8400-e29b-41d4-a716-446655440001' },
      ],
    });

    await handler(req);

    expect(req.error).not.toHaveBeenCalled();
  });

  it('rejects invalid action parameters', async () => {
    const handler = validateParams(EnrollSchema);
    const req = mockReq({
      params: { studentId: 'not-a-uuid', courseId: 'also-not-a-uuid' },
    });

    await handler(req);

    expect(req.error).toHaveBeenCalledTimes(1);
    const errorArg = (req.error as jest.Mock).mock.calls[0][0] as CAPError;
    expect(errorArg.details!.length).toBe(2);
  });
});
