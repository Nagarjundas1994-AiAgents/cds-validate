import { z, ZodTypeAny } from 'zod';

// ─── CDS Model Types (CSN — Core Schema Notation) ───────────────────────────
// These mirror the shape of a compiled CDS model returned by cds.load().
// Defined here to avoid a hard compile-time dependency on @sap/cds.

export interface CDSElement {
  /** CDS type, e.g. 'cds.String', 'cds.UUID', 'cds.Association'. */
  type: string;
  /** True if this element is part of the entity's primary key. */
  key?: boolean;
  /** CDS @mandatory annotation — marks the field as required. */
  '@mandatory'?: boolean;
  /** Database NOT NULL constraint. */
  notNull?: boolean;
  /** True if this is a virtual/computed field (skip in schema). */
  virtual?: boolean;
  /** For associations: the target entity name. */
  target?: string;
  /** String length constraint. */
  length?: number;
  /** Catch-all for other CDS annotations. */
  [annotation: string]: unknown;
}

export interface CDSEntity {
  /** The kind of definition — 'entity', 'type', 'service', etc. */
  kind: string;
  /** The entity's field definitions. */
  elements: Record<string, CDSElement>;
  /** Catch-all for other entity-level properties. */
  [key: string]: unknown;
}

export interface CDSModel {
  /** All definitions in the compiled CDS model. */
  definitions: Record<string, CDSEntity>;
  /** Catch-all for other model-level properties. */
  [key: string]: unknown;
}

// ─── Options for schemaFromEntity() ──────────────────────────────────────────

export interface SchemaFromEntityOptions {
  /**
   * Pre-loaded CDS model (CSN). If provided, `cds.load()` is skipped.
   * Use this for better performance when you already have the model,
   * or in tests where @sap/cds is not available.
   */
  model?: CDSModel;

  /**
   * Path to CDS source files. Passed to `cds.load()`.
   * @default './'
   */
  cdsFile?: string;
}

// ─── CDS Type → Zod Type Mapping ────────────────────────────────────────────
// Each entry is a factory function that returns a fresh Zod schema instance.
// We use factories (not static values) because Zod schemas are mutable
// when chained with .optional(), .partial(), etc.

const CDS_TYPE_MAP: Record<string, () => ZodTypeAny> = {
  'cds.String': () => z.string(),
  'cds.UUID': () => z.string().uuid(),
  'cds.Integer': () => z.number().int(),
  'cds.Int16': () => z.number().int(),
  'cds.Int32': () => z.number().int(),
  'cds.Int64': () => z.number().int(),
  'cds.Decimal': () => z.coerce.number(),       // coerce for safety (spec note)
  'cds.Double': () => z.number(),
  'cds.Boolean': () => z.boolean(),
  'cds.Date': () => z.string(),                  // YYYY-MM-DD format
  'cds.Time': () => z.string(),                  // HH:MM:SS format
  'cds.DateTime': () => z.string().datetime({ offset: true }).or(z.string().datetime()),
  'cds.Timestamp': () => z.string().datetime({ offset: true }).or(z.string().datetime()),
  'cds.LargeString': () => z.string(),           // No max length
  'cds.LargeBinary': () => z.any(),
  'cds.Binary': () => z.any(),
};

/**
 * Converts a single CDS element definition to a Zod type.
 *
 * Handles:
 * - Standard CDS types (String, UUID, Integer, Decimal, Boolean, Date, etc.)
 * - Associations and Compositions → mapped to `z.string().uuid()` since
 *   they arrive as foreign key values in request payloads.
 * - Unknown types → falls back to `z.any()` (never crashes)
 *
 * @param element - A CDS element definition from the compiled model.
 * @returns The corresponding Zod type.
 */
export function cdsTypeToZod(element: CDSElement): ZodTypeAny {
  // Associations/Compositions arrive as foreign keys (UUID strings).
  if (
    element.type === 'cds.Association' ||
    element.type === 'cds.Composition' ||
    element.target
  ) {
    return z.string().uuid();
  }

  const factory = CDS_TYPE_MAP[element.type];
  if (factory) return factory();

  // Fallback — never crash on unknown types
  return z.any();
}

/**
 * Finds an entity definition in the CDS model by name.
 *
 * Supports both fully-qualified names ('my.service.Students')
 * and short names ('Students') by matching against the suffix.
 */
function findEntity(
  model: CDSModel,
  entityName: string
): CDSEntity | undefined {
  // Try exact match first
  if (model.definitions[entityName]) {
    return model.definitions[entityName];
  }

  // Try suffix match (e.g., 'Students' → 'my.service.Students')
  const fullName = Object.keys(model.definitions).find(
    (key) =>
      key.endsWith(`.${entityName}`) &&
      model.definitions[key].kind === 'entity'
  );

  return fullName ? model.definitions[fullName] : undefined;
}

/**
 * Auto-builds a Zod validation schema from a CDS entity definition.
 *
 * This is the **killer feature** of cds-validate: instead of manually
 * writing Zod schemas that mirror your CDS model, call this function
 * and get a schema automatically.
 *
 * **How it determines required vs optional:**
 * - Fields with `@mandatory` annotation → **required**
 * - Key fields (e.g., UUID primary keys) → **optional** (auto-generated by CAP)
 * - All other fields → **optional**
 *
 * **What it skips:**
 * - Virtual/computed fields
 * - Fields prefixed with `_` (internal CAP fields)
 *
 * @param entityName - The CDS entity name. Supports both short names
 *   ('Students') and fully-qualified names ('my.service.Students').
 * @param options - Optional: pre-loaded model or path to CDS files.
 * @returns A Zod object schema matching the entity's field definitions.
 * @throws Error if the entity is not found in the model.
 *
 * @example
 * ```ts
 * // Auto-generate schema from CDS model
 * const StudentSchema = await schemaFromEntity('Students');
 *
 * // Use with validate()
 * srv.before('CREATE', 'Students', validate(StudentSchema));
 * ```
 */
export async function schemaFromEntity(
  entityName: string,
  options?: SchemaFromEntityOptions
): Promise<z.ZodObject<Record<string, ZodTypeAny>>> {
  let model: CDSModel;

  if (options?.model) {
    model = options.model;
  } else {
    // Dynamic require to avoid hard compile-time dependency on @sap/cds.
    // At runtime the user must have @sap/cds installed (it's a peerDependency).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cds = require('@sap/cds');
    model = await cds.load(options?.cdsFile || './');
  }

  const entity = findEntity(model, entityName);

  if (!entity) {
    throw new Error(
      `Entity '${entityName}' not found in CDS model. ` +
        `Available definitions: ${Object.keys(model.definitions)
          .filter((k) => model.definitions[k].kind === 'entity')
          .join(', ')}`
    );
  }

  const shape: Record<string, ZodTypeAny> = {};

  for (const [fieldName, element] of Object.entries(entity.elements || {})) {
    // Skip virtual/computed fields — they don't appear in request payloads
    if (element.virtual) continue;

    // Skip internal CAP fields (prefixed with underscore)
    if (fieldName.startsWith('_')) continue;

    let zodType = cdsTypeToZod(element);

    // Determine required vs optional:
    //   @mandatory → required (developer explicitly marked it)
    //   key       → optional (auto-generated by CAP, e.g. UUID PKs)
    //   else      → optional (safe default)
    const isMandatory = element['@mandatory'] === true;
    const isKey = element.key === true;

    if (!isMandatory || isKey) {
      zodType = zodType.optional();
    }

    shape[fieldName] = zodType;
  }

  return z.object(shape);
}
