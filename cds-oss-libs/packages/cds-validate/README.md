<div align="center">

# 🛡️ cds-validate

**Zod-powered validation middleware for SAP CAP**

Stop writing 50 lines of `if`-checks. One line. One schema. Done.

[![npm version](https://img.shields.io/npm/v/cds-validate?style=for-the-badge&color=CB3837&logo=npm&logoColor=white)](https://www.npmjs.com/package/cds-validate)
[![license](https://img.shields.io/npm/l/cds-validate?style=for-the-badge&color=blue)](./LICENSE)
[![tests](https://img.shields.io/badge/tests-56%20passed-brightgreen?style=for-the-badge&logo=jest&logoColor=white)](./tests)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SAP CAP](https://img.shields.io/badge/SAP_CAP-7.0+-0FAAFF?style=for-the-badge&logo=sap&logoColor=white)](https://cap.cloud.sap/)

<br/>

[Installation](#-installation) •
[Quick Start](#-quick-start) •
[API Reference](#-api-reference) •
[Use Cases](#-use-cases) •
[Contributing](#-contributing)

<br/>

---

</div>

## 🤔 The Problem

Every SAP CAP developer writes the same boilerplate validation code over and over:

```js
// ❌ This is what you're doing today — fragile, verbose, unmaintainable
srv.before('CREATE', 'Students', (req) => {
  if (!req.data.name) req.error(400, 'Name is required');
  if (!req.data.email) req.error(400, 'Email is required');
  if (req.data.email && !req.data.email.includes('@')) req.error(400, 'Invalid email');
  if (req.data.gpa && typeof req.data.gpa !== 'number') req.error(400, 'GPA must be a number');
  if (req.data.gpa && (req.data.gpa < 0 || req.data.gpa > 4)) req.error(400, 'GPA must be 0-4');
  // ... 20 more lines for each entity
});
```

This doesn't scale. It doesn't compose. It doesn't give you type safety. And when you have 30 entities with 15 fields each, you're drowning in `if`-statements.

## ✨ The Solution

```js
// ✅ One line. Type-safe. Auto-coercion. OData-compliant errors.
srv.before('CREATE', 'Students', validate(StudentSchema));
```

**cds-validate** wraps your CAP handlers with [Zod](https://zod.dev/) schema validation, giving you:

| Feature | What It Does |
|---|---|
| 🛡️ **Schema validation** | Validate `req.data`, `req.query`, and `req.params` with Zod |
| 🔄 **Auto-partial on UPDATE** | `schema.partial()` applied automatically for PATCH/UPDATE |
| 🎯 **Type coercion** | `"3"` → `3`, trims whitespace, normalizes emails — for free |
| 📋 **OData errors** | Returns proper OData error responses (HTTP 422) with field details |
| 🏗️ **Auto-schema generation** | Build Zod schemas from your CDS model — zero manual work |
| 📦 **Zero config** | Works out of the box with any CAP project |

---

## 📦 Installation

```bash
# npm
npm install cds-validate zod

# pnpm
pnpm add cds-validate zod

# yarn
yarn add cds-validate zod
```

> **Peer dependencies:** Requires `@sap/cds` (≥7.0.0) and `zod` (≥3.20.0) — you almost certainly have `@sap/cds` already.

### Compatibility

| Environment | Version |
|---|---|
| Node.js | 18, 20, 22+ |
| @sap/cds | ≥ 7.0.0 |
| Zod | ≥ 3.20.0 |
| TypeScript | ≥ 5.0 (optional) |

---

## 🚀 Quick Start

### 1. Define your schema

```ts
// srv/schemas.js
const { z } = require('zod');

const StudentSchema = z.object({
  name:     z.string().min(1, 'Name is required'),
  email:    z.string().trim().email('Invalid email format'),
  gpa:      z.coerce.number().min(0).max(4).optional(),
  enrolled: z.boolean().optional(),
});

module.exports = { StudentSchema };
```

### 2. Use in your CAP service

```js
// srv/student-service.js
const { validate } = require('cds-validate');
const { StudentSchema } = require('./schemas');

module.exports = (srv) => {
  // CREATE — all required fields enforced
  srv.before('CREATE', 'Students', validate(StudentSchema));

  // UPDATE — only provided fields are validated (auto-partial)
  srv.before('UPDATE', 'Students', validate(StudentSchema));
};
```

### 3. That's it! ✅

Invalid requests now return clean OData errors:

```json
{
  "error": {
    "code": 422,
    "message": "Validation failed with 2 errors",
    "target": "email",
    "details": [
      { "message": "Invalid email format", "target": "email" },
      { "message": "Number must be less than or equal to 4", "target": "gpa" }
    ]
  }
}
```

---

## 🎯 Use Cases

### When Should You Use `cds-validate`?

<details>
<summary><b>🏢 Enterprise CRUD Apps</b> — Validate every entity consistently</summary>

You have 30+ entities (Employees, Orders, Products, Invoices...) and need consistent validation across all of them. Instead of writing validation logic in each handler:

```js
const { validate, schemaFromEntity } = require('cds-validate');

module.exports = async (srv) => {
  // Auto-generate schemas from your CDS model
  const EmployeeSchema  = await schemaFromEntity('Employees');
  const OrderSchema     = await schemaFromEntity('Orders');
  const ProductSchema   = await schemaFromEntity('Products');

  // Apply validation to all entities
  for (const [name, schema] of Object.entries({
    Employees: EmployeeSchema,
    Orders: OrderSchema,
    Products: ProductSchema,
  })) {
    srv.before('CREATE', name, validate(schema));
    srv.before('UPDATE', name, validate(schema));
  }
};
```

</details>

<details>
<summary><b>🔌 API Gateway / BTP Integration</b> — Validate incoming payloads before processing</summary>

When your CAP service acts as an API gateway receiving external payloads, you need strict validation to prevent garbage data from reaching your database:

```js
const ExternalPayloadSchema = z.object({
  transactionId: z.string().uuid(),
  amount:        z.coerce.number().positive(),
  currency:      z.enum(['USD', 'EUR', 'GBP', 'INR']),
  timestamp:     z.string().datetime(),
  metadata:      z.record(z.string()).optional(),
});

srv.before('CREATE', 'ExternalTransactions',
  validate(ExternalPayloadSchema, { strict: true })
);
```

</details>

<details>
<summary><b>📊 Fiori Elements Apps</b> — Better error messages for UI5 frontends</summary>

Fiori Elements and UI5 understand OData error format natively. `cds-validate` returns errors in exactly this format, so your Fiori app automatically highlights the right fields:

```js
const InvoiceSchema = z.object({
  vendorId:    z.string().uuid('Please select a valid vendor'),
  amount:      z.coerce.number().positive('Amount must be positive'),
  invoiceDate: z.string().min(1, 'Invoice date is required'),
  lineItems:   z.array(z.object({
    productId: z.string().uuid(),
    quantity:  z.number().int().positive(),
  })).min(1, 'At least one line item required'),
});

// Fiori Elements will show field-level errors automatically
srv.before('CREATE', 'Invoices', validate(InvoiceSchema));
```

</details>

<details>
<summary><b>🔧 Custom Actions & Functions</b> — Validate action parameters</summary>

```js
const PromoteParams = z.object({
  employeeId:  z.string().uuid(),
  newTitle:    z.string().min(3).max(100),
  salaryBump:  z.coerce.number().min(0).max(50), // percentage
  effectiveDate: z.string().datetime(),
});

srv.before('promoteEmployee', validateParams(PromoteParams));
```

</details>

<details>
<summary><b>📡 OData Query Validation</b> — Prevent expensive queries</summary>

```js
const ReadQuerySchema = z.object({
  $top:     z.coerce.number().max(100, 'Max 100 records per page').optional(),
  $skip:    z.coerce.number().min(0).optional(),
  $orderby: z.string().optional(),
});

// Prevent clients from requesting 10,000 records at once
srv.before('READ', 'LargeDataSet', validateQuery(ReadQuerySchema));
```

</details>

### When NOT to Use It

| Scenario | Why Not | Alternative |
|---|---|---|
| Database constraints only | CDS `@mandatory` and DB constraints handle this | Use CDS annotations |
| Complex business rules | Validation across multiple entities/services | Write custom handler logic |
| Performance-critical hot paths | Adding Zod parsing overhead | Validate at API gateway level |

---

## 📖 API Reference

### `validate(schema, options?)`

> Creates middleware that validates `req.data` against a Zod schema.

```ts
function validate(schema: ZodSchema, options?: ValidationOptions): CAPHandler
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `schema` | `ZodSchema` | *required* | The Zod schema to validate against |
| `options.strict` | `boolean` | `false` | Reject unknown keys not in the schema |
| `options.normalize` | `boolean` | `true` | Overwrite `req.data` with parsed output |

**Key behaviors:**

- **CREATE** → validates all fields as defined
- **UPDATE / PATCH** → auto-applies `schema.partial()` so missing fields are allowed
- **normalize: true** → `req.data` is replaced with Zod-parsed output, giving you:
  - Type coercion: `z.coerce.number()` converts `"42"` → `42`
  - Transforms: `z.string().trim()` strips whitespace
  - Defaults: `z.string().default('N/A')` fills missing values

```js
// Basic usage
srv.before('CREATE', 'Students', validate(StudentSchema));

// With options
srv.before('CREATE', 'Students', validate(StudentSchema, {
  strict: true,       // reject unknown fields like { hackerField: '...' }
  normalize: false,   // keep original req.data, don't overwrite with parsed
}));

// Works for UPDATE automatically — only validates fields that are present
srv.before('UPDATE', 'Students', validate(StudentSchema));
// Sending { name: 'New Name' } won't fail for missing email/gpa
```

---

### `validateQuery(schema, options?)`

> Creates middleware that validates `req.query` — for OData query parameters.

```ts
function validateQuery(schema: ZodSchema, options?: ValidationOptions): CAPHandler
```

```js
const PaginationSchema = z.object({
  $top:     z.coerce.number().int().min(1).max(100).optional(),
  $skip:    z.coerce.number().int().min(0).optional(),
  $orderby: z.string().optional(),
  $filter:  z.string().optional(),
  $select:  z.string().optional(),
});

srv.before('READ', 'Products', validateQuery(PaginationSchema));
```

---

### `validateParams(schema, options?)`

> Creates middleware that validates `req.params` — for bound action/function parameters.

```ts
function validateParams(schema: ZodSchema, options?: ValidationOptions): CAPHandler
```

Handles both object form (`{ id: '...' }`) and array form (`[{ id: '...' }]`) of `req.params`.

```js
const TransferParams = z.object({
  fromAccount: z.string().uuid(),
  toAccount:   z.string().uuid(),
  amount:      z.coerce.number().positive(),
});

srv.before('transferFunds', validateParams(TransferParams));
```

---

### `schemaFromEntity(entityName, options?)`

> Auto-builds a Zod schema from a CDS entity definition. **The killer feature.**

```ts
async function schemaFromEntity(
  entityName: string,
  options?: SchemaFromEntityOptions
): Promise<ZodObject>
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `entityName` | `string` | *required* | Short (`'Students'`) or fully-qualified (`'my.service.Students'`) |
| `options.model` | `CDSModel` | *auto-loaded* | Pre-loaded CDS model (skips `cds.load()`) |
| `options.cdsFile` | `string` | `'./'` | Path to CDS source files |

**How fields are mapped:**

| CDS Type | → Zod Type | Notes |
|---|---|---|
| `cds.String` | `z.string()` | |
| `cds.UUID` | `z.string().uuid()` | |
| `cds.Integer` | `z.number().int()` | Also Int16, Int32, Int64 |
| `cds.Decimal` | `z.coerce.number()` | Coerces strings for safety |
| `cds.Boolean` | `z.boolean()` | |
| `cds.Date` | `z.string()` | Format: YYYY-MM-DD |
| `cds.DateTime` | `z.string().datetime()` | ISO 8601 |
| `cds.Timestamp` | `z.string().datetime()` | ISO 8601 |
| `cds.LargeString` | `z.string()` | No max length |
| Association | `z.string().uuid()` | Arrives as foreign key |
| Unknown | `z.any()` | Fallback — never crashes |

**Field optionality rules:**

| Condition | Result |
|---|---|
| `@mandatory` annotation | **Required** |
| `key: true` field | **Optional** (auto-generated by CAP) |
| Virtual / computed field | **Skipped** entirely |
| `_`-prefixed field | **Skipped** (internal CAP field) |
| Everything else | **Optional** |

```js
const { schemaFromEntity, validate } = require('cds-validate');

module.exports = async (srv) => {
  // Auto-generate — no manual schema writing needed!
  const StudentSchema = await schemaFromEntity('Students');

  srv.before('CREATE', 'Students', validate(StudentSchema));
  srv.before('UPDATE', 'Students', validate(StudentSchema));
};
```

---

### `mapZodError(zodError)`

> Low-level utility: converts a `ZodError` into a CAP OData error object.

```ts
function mapZodError(zodError: ZodError): CAPError
```

Used internally by `validate()`, but exported for custom validation flows:

```js
const { mapZodError } = require('cds-validate');

srv.before('CREATE', 'Students', (req) => {
  const result = MyCustomSchema.safeParse(req.data);
  if (!result.success) {
    const capError = mapZodError(result.error);
    // capError = { code: 422, message: '...', target: 'email', details: [...] }
    req.error(capError);
  }
});
```

### `cdsTypeToZod(element)`

> Converts a single CDS element definition to a Zod type. Useful for building custom schemas.

```ts
function cdsTypeToZod(element: CDSElement): ZodTypeAny
```

---

## 🧩 TypeScript Support

Full first-class TypeScript support with exported types:

```ts
import {
  // Functions
  validate,
  validateQuery,
  validateParams,
  schemaFromEntity,
  mapZodError,
  cdsTypeToZod,

  // Types
  type CAPRequest,
  type CAPError,
  type CAPErrorDetail,
  type ValidationOptions,
  type CAPHandler,
  type ValidateSchema,
  type CDSElement,
  type CDSEntity,
  type CDSModel,
  type SchemaFromEntityOptions,
} from 'cds-validate';
```

---

## 🧪 Error Response Format

All validation errors follow the [OData JSON error format](https://docs.oasis-open.org/odata/odata-json-format/v4.01/odata-json-format-v4.01.html#sec_ErrorResponse):

```jsonc
// Single field error
{
  "error": {
    "code": 422,
    "message": "Invalid email format",
    "target": "email",
    "details": [
      { "message": "Invalid email format", "target": "email" }
    ]
  }
}

// Multiple field errors
{
  "error": {
    "code": 422,
    "message": "Validation failed with 3 errors",
    "target": "name",
    "details": [
      { "message": "Name is required",               "target": "name" },
      { "message": "Invalid email format",            "target": "email" },
      { "message": "Number must be at most 4",        "target": "gpa" }
    ]
  }
}

// Nested field error
{
  "error": {
    "code": 422,
    "message": "Zip must be 5 characters",
    "target": "address/zipCode",
    "details": [
      { "message": "Zip must be 5 characters", "target": "address/zipCode" }
    ]
  }
}
```

The `target` field uses `/`-separated paths — this is standard OData syntax.

---

## 📋 Advanced Examples

### Conditional validation with refinements

```js
const OrderSchema = z.object({
  type:        z.enum(['standard', 'express', 'overnight']),
  amount:      z.coerce.number().positive(),
  deliveryDate: z.string().datetime().optional(),
}).refine(
  (data) => data.type !== 'express' || data.deliveryDate != null,
  { message: 'Express orders require a delivery date', path: ['deliveryDate'] }
);
```

### Reusable field schemas

```js
const Email = z.string().trim().toLowerCase().email('Invalid email');
const UUID  = z.string().uuid('Invalid ID format');
const Money = z.coerce.number().positive().multipleOf(0.01);

const InvoiceSchema = z.object({
  vendorEmail: Email,
  vendorId:    UUID,
  amount:      Money,
  currency:    z.enum(['USD', 'EUR', 'GBP']),
});
```

### Combining auto-generated and manual schemas

```js
module.exports = async (srv) => {
  // Start from CDS model...
  const baseSchema = await schemaFromEntity('Students');

  // ...then extend with custom rules
  const strictSchema = baseSchema.extend({
    email: z.string().trim().toLowerCase().email(),
    gpa:   z.coerce.number().min(0).max(4),
  });

  srv.before('CREATE', 'Students', validate(strictSchema));
};
```

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Your CAP Service Handler                                │
│  srv.before('CREATE', 'Students', validate(schema))      │
└──────────────────────────┬───────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │  validator   │  ← Higher-order middleware factory
                    │              │     Detects event type (CREATE/UPDATE)
                    │              │     Applies .partial() for UPDATE
                    └──────┬──────┘
                           │
               ┌───────────┴───────────┐
               │                       │
        ┌──────▼──────┐         ┌──────▼──────┐
        │  Zod Schema  │         │ error-mapper │
        │  .safeParse() │         │              │
        │              │         │ ZodError →   │
        │  ✅ success   │         │ OData 422    │
        │  → normalize │         │ { code,      │
        │    req.data  │         │   message,   │
        │              │         │   target,    │
        │  ❌ failure   ─────────▶   details }  │
        └──────────────┘         └──────┬──────┘
                                        │
                                 ┌──────▼──────┐
                                 │ req.error()  │
                                 │ CAP handles  │
                                 │ the rest     │
                                 └─────────────┘
```

---

## 📦 What's Included

```
cds-validate/
├── dist/
│   ├── index.js          ← CommonJS entry point
│   ├── index.d.ts        ← TypeScript declarations
│   ├── validator.js
│   ├── error-mapper.js
│   ├── schema-builder.js
│   └── types.js
├── README.md
└── LICENSE
```

**Package size:** ~13 KB (packed)

---

## 🔄 Version History

See [CHANGELOG.md](./CHANGELOG.md) for the full release history.

| Version | Date | Highlights |
|---|---|---|
| **1.0.0** | 2026-04-16 | 🎉 Initial release — `validate()`, `validateQuery()`, `validateParams()`, `schemaFromEntity()`, `mapZodError()`, `cdsTypeToZod()` |

### Versioning Strategy

This project follows [Semantic Versioning](https://semver.org/):

| Change | When | Example |
|---|---|---|
| **Patch** (1.0.x) | Bug fixes, no API changes | `1.0.0` → `1.0.1` |
| **Minor** (1.x.0) | New features, backwards compatible | `1.0.0` → `1.1.0` |
| **Major** (x.0.0) | Breaking API changes | `1.0.0` → `2.0.0` |

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

```bash
# 1. Clone the monorepo
git clone https://github.com/YOUR_USERNAME/cds-validate.git
cd cds-oss-libs

# 2. Install dependencies
pnpm install

# 3. Run tests
cd packages/cds-validate
pnpm test           # Run all 56 tests
pnpm test:watch     # Watch mode
pnpm test -- --coverage  # With coverage report

# 4. Type-check
pnpm lint           # tsc --noEmit

# 5. Build
pnpm build          # Compile to dist/
```

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Write tests first, then implementation
4. Ensure all tests pass: `pnpm test`
5. Ensure types are clean: `pnpm lint`
6. Submit a Pull Request

---

## 📄 License

[MIT](./LICENSE) — use it freely in personal and commercial projects.

---

<div align="center">

**Built with ❤️ for the SAP CAP community**

If this saved you time, ⭐ the repo and share it!

[Report a Bug](https://github.com/YOUR_USERNAME/cds-validate/issues) •
[Request a Feature](https://github.com/YOUR_USERNAME/cds-validate/issues) •
[npm Package](https://www.npmjs.com/package/cds-validate)

</div>
