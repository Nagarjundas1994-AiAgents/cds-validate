import { z } from 'zod';
import { schemaFromEntity, cdsTypeToZod, CDSModel, CDSElement } from '../src/schema-builder';

// ─── Mock CDS Model ──────────────────────────────────────────────────────────
// Realistic CSN (Core Schema Notation) structure matching what cds.load() returns.

const MOCK_MODEL: CDSModel = {
  definitions: {
    'test.StudentService.Students': {
      kind: 'entity',
      elements: {
        ID: { type: 'cds.UUID', key: true },
        name: { type: 'cds.String', '@mandatory': true },
        email: { type: 'cds.String', '@mandatory': true },
        gpa: { type: 'cds.Decimal' },
        enrolled: { type: 'cds.Boolean' },
        birthDate: { type: 'cds.Date' },
        bio: { type: 'cds.LargeString' },
        createdAt: { type: 'cds.DateTime', virtual: true },
        _internalFlag: { type: 'cds.Boolean' },
        department: {
          type: 'cds.Association',
          target: 'test.StudentService.Departments',
        },
        department_ID: { type: 'cds.UUID' },
      },
    },
    'test.StudentService.Departments': {
      kind: 'entity',
      elements: {
        ID: { type: 'cds.UUID', key: true },
        name: { type: 'cds.String', '@mandatory': true },
      },
    },
    'test.StudentService': {
      kind: 'service',
      elements: {},
    },
  },
};

// ─── cdsTypeToZod() unit tests ───────────────────────────────────────────────

describe('cdsTypeToZod() — CDS type mapping', () => {
  const cases: [string, CDSElement, unknown, unknown][] = [
    // [label, element, validValue, invalidValue]
    ['cds.String → z.string()', { type: 'cds.String' }, 'hello', 123],
    ['cds.UUID → z.string().uuid()', { type: 'cds.UUID' }, '550e8400-e29b-41d4-a716-446655440000', 'not-a-uuid'],
    ['cds.Integer → z.number().int()', { type: 'cds.Integer' }, 42, 3.14],
    ['cds.Decimal → z.coerce.number()', { type: 'cds.Decimal' }, 3.14, undefined], // coerce accepts strings too
    ['cds.Boolean → z.boolean()', { type: 'cds.Boolean' }, true, 'yes'],
    ['cds.Date → z.string()', { type: 'cds.Date' }, '2024-01-15', undefined],
    ['cds.LargeString → z.string()', { type: 'cds.LargeString' }, 'long text', 123],
  ];

  it.each(cases)('%s accepts valid values', (_label, element, validValue) => {
    const zodType = cdsTypeToZod(element);
    const result = zodType.safeParse(validValue);
    expect(result.success).toBe(true);
  });

  it.each(
    cases.filter(([, , , invalid]) => invalid !== undefined)
  )('%s rejects invalid values', (_label, element, _valid, invalidValue) => {
    const zodType = cdsTypeToZod(element);
    const result = zodType.safeParse(invalidValue);
    expect(result.success).toBe(false);
  });

  it('maps associations to z.string().uuid()', () => {
    const assocElement: CDSElement = {
      type: 'cds.Association',
      target: 'some.Entity',
    };
    const zodType = cdsTypeToZod(assocElement);

    expect(zodType.safeParse('550e8400-e29b-41d4-a716-446655440000').success).toBe(true);
    expect(zodType.safeParse('not-a-uuid').success).toBe(false);
  });

  it('maps compositions to z.string().uuid()', () => {
    const compElement: CDSElement = {
      type: 'cds.Composition',
      target: 'some.Entity',
    };
    const zodType = cdsTypeToZod(compElement);

    expect(zodType.safeParse('550e8400-e29b-41d4-a716-446655440000').success).toBe(true);
  });

  it('maps elements with a target property (shorthand associations)', () => {
    const element: CDSElement = {
      type: 'cds.SomeType',
      target: 'some.Entity',
    };
    const zodType = cdsTypeToZod(element);

    expect(zodType.safeParse('550e8400-e29b-41d4-a716-446655440000').success).toBe(true);
  });

  it('falls back to z.any() for unknown CDS types', () => {
    const element: CDSElement = { type: 'cds.SomeNewType' };
    const zodType = cdsTypeToZod(element);

    // z.any() accepts everything
    expect(zodType.safeParse('anything').success).toBe(true);
    expect(zodType.safeParse(42).success).toBe(true);
    expect(zodType.safeParse(null).success).toBe(true);
  });

  it('handles cds.DateTime with ISO strings', () => {
    const element: CDSElement = { type: 'cds.DateTime' };
    const zodType = cdsTypeToZod(element);

    expect(zodType.safeParse('2024-01-15T10:30:00Z').success).toBe(true);
    expect(zodType.safeParse('2024-01-15T10:30:00+05:30').success).toBe(true);
  });
});

// ─── schemaFromEntity() integration tests ────────────────────────────────────

describe('schemaFromEntity() — auto-build Zod schema from CDS entity', () => {
  it('returns a valid Zod schema for a known entity (short name)', async () => {
    const schema = await schemaFromEntity('Students', { model: MOCK_MODEL });

    expect(schema).toBeDefined();
    expect(schema instanceof z.ZodObject).toBe(true);
  });

  it('returns a valid Zod schema for a fully-qualified entity name', async () => {
    const schema = await schemaFromEntity('test.StudentService.Students', {
      model: MOCK_MODEL,
    });

    expect(schema).toBeDefined();
    expect(schema instanceof z.ZodObject).toBe(true);
  });

  it('throws an error for an unknown entity', async () => {
    await expect(
      schemaFromEntity('NonExistent', { model: MOCK_MODEL })
    ).rejects.toThrow("Entity 'NonExistent' not found in CDS model");
  });

  it('error message lists available entities', async () => {
    await expect(
      schemaFromEntity('NonExistent', { model: MOCK_MODEL })
    ).rejects.toThrow(/Students/);
  });

  // ─── Field validation tests ─────────────────────────────────────────────

  it('accepts a complete valid student object', async () => {
    const schema = await schemaFromEntity('Students', { model: MOCK_MODEL });

    const result = schema.safeParse({
      name: 'Alice',
      email: 'alice@example.com',
      gpa: 3.5,
      enrolled: true,
      birthDate: '2000-01-15',
    });

    expect(result.success).toBe(true);
  });

  it('requires @mandatory fields (name, email)', async () => {
    const schema = await schemaFromEntity('Students', { model: MOCK_MODEL });

    // Missing both mandatory fields
    const result = schema.safeParse({ gpa: 3.5 });

    expect(result.success).toBe(false);
    if (!result.success) {
      const targets = result.error.issues.map((i) => i.path[0]);
      expect(targets).toContain('name');
      expect(targets).toContain('email');
    }
  });

  it('makes key fields (ID) optional', async () => {
    const schema = await schemaFromEntity('Students', { model: MOCK_MODEL });

    // No ID provided — should be fine (auto-generated)
    const result = schema.safeParse({
      name: 'Alice',
      email: 'alice@example.com',
    });

    expect(result.success).toBe(true);
  });

  it('makes non-mandatory fields optional', async () => {
    const schema = await schemaFromEntity('Students', { model: MOCK_MODEL });

    // Only mandatory fields — gpa, enrolled, birthDate all missing
    const result = schema.safeParse({
      name: 'Alice',
      email: 'alice@example.com',
    });

    expect(result.success).toBe(true);
  });

  it('skips virtual fields (createdAt)', async () => {
    const schema = await schemaFromEntity('Students', { model: MOCK_MODEL });
    const schemaShape = schema.shape;

    expect(schemaShape).not.toHaveProperty('createdAt');
  });

  it('skips internal fields prefixed with underscore', async () => {
    const schema = await schemaFromEntity('Students', { model: MOCK_MODEL });
    const schemaShape = schema.shape;

    expect(schemaShape).not.toHaveProperty('_internalFlag');
  });

  it('includes association foreign key fields', async () => {
    const schema = await schemaFromEntity('Students', { model: MOCK_MODEL });
    const schemaShape = schema.shape;

    // The navigation property (association) and the FK field should both be present
    expect(schemaShape).toHaveProperty('department');
    expect(schemaShape).toHaveProperty('department_ID');
  });

  it('validates UUID format for association fields', async () => {
    const schema = await schemaFromEntity('Students', { model: MOCK_MODEL });

    const result = schema.safeParse({
      name: 'Alice',
      email: 'alice@example.com',
      department: 'not-a-uuid',
    });

    expect(result.success).toBe(false);
  });

  it('coerces decimal values via z.coerce.number()', async () => {
    const schema = await schemaFromEntity('Students', { model: MOCK_MODEL });

    const result = schema.safeParse({
      name: 'Alice',
      email: 'alice@example.com',
      gpa: '3.5', // string should be coerced to number
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.gpa).toBe(3.5);
      expect(typeof result.data.gpa).toBe('number');
    }
  });

  // ─── Works with validate() ──────────────────────────────────────────────

  it('generated schema works with validate() middleware', async () => {
    const { validate } = require('../src/validator');
    const schema = await schemaFromEntity('Students', { model: MOCK_MODEL });
    const handler = validate(schema);

    const req = {
      data: { name: 'Alice', email: 'alice@example.com', gpa: 3.5 },
      query: {},
      params: {},
      event: 'CREATE',
      error: jest.fn(),
    };

    await handler(req);

    expect(req.error).not.toHaveBeenCalled();
  });

  it('generated schema + validate() catches invalid data', async () => {
    const { validate } = require('../src/validator');
    const schema = await schemaFromEntity('Students', { model: MOCK_MODEL });
    const handler = validate(schema);

    const req = {
      data: { gpa: 3.5 }, // missing mandatory name and email
      query: {},
      params: {},
      event: 'CREATE',
      error: jest.fn(),
    };

    await handler(req);

    expect(req.error).toHaveBeenCalledTimes(1);
    const errorArg = req.error.mock.calls[0][0];
    expect(errorArg.code).toBe(422);
  });
});
