<div align="center">

# 🛡️ cds-validate

### Zod-powered validation middleware for SAP CAP

Stop writing 50 lines of `if`-checks in every CAP handler.<br/>
**One line. One schema. Done.**

<br/>

[![npm version](https://img.shields.io/npm/v/cds-validate?style=for-the-badge&color=CB3837&logo=npm&logoColor=white)](https://www.npmjs.com/package/cds-validate)
[![license](https://img.shields.io/npm/l/cds-validate?style=for-the-badge&color=blue)](./packages/cds-validate/LICENSE)
[![tests](https://img.shields.io/badge/tests-56%20passed-brightgreen?style=for-the-badge&logo=jest&logoColor=white)](./packages/cds-validate/tests)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SAP CAP](https://img.shields.io/badge/SAP_CAP-7.0+-0FAAFF?style=for-the-badge&logo=sap&logoColor=white)](https://cap.cloud.sap/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=for-the-badge)](https://github.com/Nagarjundas1994-AiAgents/cds-validate/pulls)

<br/>

[Why This Exists](#-why-this-exists) •
[Installation](#-installation) •
[Quick Start](#-quick-start) •
[How It Works](#-how-it-works) •
[API Reference](#-api-reference) •
[Real World Examples](#-real-world-examples) •
[FAQ](#-faq)

<br/>

</div>

---

## 💡 Why This Exists

Every SAP CAP developer has written code like this:

```js
// ❌ This is what most CAP projects look like today
srv.before('CREATE', 'Students', (req) => {
  if (!req.data.name || req.data.name.trim() === '')
    req.error(400, 'Name is required', 'name');
  if (!req.data.email)
    req.error(400, 'Email is required', 'email');
  if (req.data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.data.email))
    req.error(400, 'Invalid email format', 'email');
  if (req.data.gpa !== undefined && typeof req.data.gpa !== 'number')
    req.error(400, 'GPA must be a number', 'gpa');
  if (req.data.gpa !== undefined && (req.data.gpa < 0 || req.data.gpa > 4))
    req.error(400, 'GPA must be between 0 and 4', 'gpa');
  // ... and this repeats for every single entity ...
});
```

**The problems:**

| # | Problem | Impact |
|---|---------|--------|
| 1 | 📝 **Boilerplate explosion** | 30 entities × 15 fields = hundreds of lines of `if`-checks |
| 2 | 🐛 **Easy to miss edge cases** | Forgot to check empty strings? Forgot to trim? |
| 3 | 🔧 **No type coercion** | URL params come as strings — you manually parse `"3"` to `3` |
| 4 | 🔄 **UPDATE headaches** | Partial updates need different validation than CREATE |
| 5 | ❌ **Inconsistent errors** | Each developer formats errors differently |
| 6 | 📋 **Not OData-compliant** | Fiori Elements can't show field-level errors properly |

**cds-validate solves all of this in one line:**

```js
// ✅ One line. Type-safe. Auto-coercion. OData errors. Partial UPDATE support.
srv.before('CREATE', 'Students', validate(StudentSchema));
```

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

### Requirements

| Dependency | Version | Notes |
|-----------|---------|-------|
| **Node.js** | 18, 20, 22+ | LTS versions |
| **@sap/cds** | ≥ 7.0.0 | Peer dependency — you already have this |
| **zod** | ≥ 3.20.0 | Peer dependency — install alongside |
| **TypeScript** | ≥ 5.0 | Optional — full `.d.ts` included |

---

## 🚀 Quick Start

### Option A: Write your own Zod schema

```js
const { validate } = require('cds-validate');
const { z } = require('zod');

const StudentSchema = z.object({
  name:     z.string().min(1, 'Name is required'),
  email:    z.string().trim().email('Invalid email'),
  gpa:      z.coerce.number().min(0).max(4).optional(),
  enrolled: z.boolean().optional(),
});

module.exports = (srv) => {
  srv.before('CREATE', 'Students', validate(StudentSchema));
  srv.before('UPDATE', 'Students', validate(StudentSchema)); // auto-partial!
};
```

### Option B: Auto-generate from your CDS model (zero manual work)

```js
const { schemaFromEntity, validate } = require('cds-validate');

module.exports = async (srv) => {
  const StudentSchema = await schemaFromEntity('Students');

  srv.before('CREATE', 'Students', validate(StudentSchema));
  srv.before('UPDATE', 'Students', validate(StudentSchema));
};
```

**That's it.** Invalid requests now return clean OData 422 errors automatically.

---

## ⚙️ How It Works

Here's what happens when a request hits your validated endpoint:

```
  Client sends POST /Students { name: "", email: "bad", gpa: 5 }
                          │
                          ▼
              ┌───────────────────────┐
              │   validate(schema)    │  ◀── Your middleware
              │                       │
              │  1. Detect event type │
              │     CREATE → full     │
              │     UPDATE → partial  │
              │                       │
              │  2. schema.safeParse  │
              │     (req.data)        │
              └───────────┬───────────┘
                          │
              ┌───────────┴───────────┐
              │                       │
         ✅ Valid                 ❌ Invalid
              │                       │
              ▼                       ▼
    ┌─────────────────┐   ┌──────────────────────┐
    │  Normalize data  │   │    error-mapper       │
    │  • Type coerce   │   │    ZodError → OData   │
    │  • Trim strings  │   │    422 response        │
    │  • Apply defaults│   │                        │
    │                  │   │  ┌──────────────────┐  │
    │  Overwrite       │   │  │ { code: 422,     │  │
    │  req.data with   │   │  │   message: "..." │  │
    │  parsed result   │   │  │   target: "email"│  │
    └─────────────────┘   │  │   details: [...]  │  │
              │            │  └──────────────────┘  │
              ▼            └──────────┬─────────────┘
    ┌─────────────────┐               │
    │  Continue to     │               ▼
    │  your handler    │     ┌─────────────────┐
    │  with clean data │     │  req.error()    │
    └─────────────────┘     │  → stops request │
                             └─────────────────┘
```

### Key behaviors:

| Event | What happens | Why |
|-------|-------------|-----|
| **CREATE** | Full schema validation | All required fields must be present |
| **UPDATE** | `schema.partial()` auto-applied | Only validate fields that were sent |
| **PATCH** | Same as UPDATE | Treated identically |
| **Custom action** | Full validation | Use `validateParams()` for action params |

---

## 📖 API Reference

### `validate(schema, options?)`

The main middleware — validates `req.data`.

```js
srv.before('CREATE', 'Students', validate(StudentSchema));
srv.before('CREATE', 'Students', validate(StudentSchema, { strict: true }));
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `strict` | `boolean` | `false` | Reject unknown keys not in schema |
| `normalize` | `boolean` | `true` | Replace `req.data` with Zod-parsed output |

> 💡 **`normalize: true` is powerful** — it gives you free type coercion (`"42"` → `42`), string trimming, default values, and Zod transforms without any extra code.

---

### `validateQuery(schema, options?)`

Validates `req.query` — perfect for controlling OData query parameters.

```js
const PaginationSchema = z.object({
  $top:  z.coerce.number().int().max(100, 'Max 100 records').optional(),
  $skip: z.coerce.number().int().min(0).optional(),
});

srv.before('READ', 'Products', validateQuery(PaginationSchema));
```

---

### `validateParams(schema, options?)`

Validates `req.params` — for bound action/function parameters.

```js
const TransferParams = z.object({
  fromAccount: z.string().uuid(),
  toAccount:   z.string().uuid(),
  amount:      z.coerce.number().positive(),
});

srv.before('transferFunds', validateParams(TransferParams));
```

> Handles both object (`{ id: '...' }`) and array (`[{ id: '...' }]`) forms of `req.params` automatically.

---

### `schemaFromEntity(entityName, options?)`

🏗️ **The killer feature** — auto-generates Zod schemas from your CDS model.

```js
const StudentSchema = await schemaFromEntity('Students');
// Equivalent to manually writing:
// z.object({ ID: z.string().uuid().optional(), name: z.string(), ... })
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | `CDSModel` | auto-loaded | Pre-loaded CSN model (skips `cds.load()`) |
| `cdsFile` | `string` | `'./'` | Path to CDS source files |

**CDS → Zod type mapping:**

| CDS Type | Zod Type | Notes |
|----------|----------|-------|
| `cds.String` | `z.string()` | |
| `cds.UUID` | `z.string().uuid()` | |
| `cds.Integer` | `z.number().int()` | Also `Int16`, `Int32`, `Int64` |
| `cds.Decimal` | `z.coerce.number()` | Coerces strings safely |
| `cds.Boolean` | `z.boolean()` | |
| `cds.Date` | `z.string()` | `YYYY-MM-DD` |
| `cds.DateTime` | `z.string().datetime()` | ISO 8601 |
| `cds.LargeString` | `z.string()` | No max length |
| Association | `z.string().uuid()` | Foreign keys |
| Unknown type | `z.any()` | Safe fallback |

**Field rules:**

| CDS Annotation | Schema Result | Reason |
|---------------|---------------|--------|
| `@mandatory` | **Required** | Developer explicitly marked it |
| `key: true` | **Optional** | Auto-generated (UUID PKs) |
| `virtual: true` | **Skipped** | Not in request payload |
| `_`-prefixed | **Skipped** | Internal CAP fields |
| Everything else | **Optional** | Safe default |

---

### `mapZodError(zodError)` / `cdsTypeToZod(element)`

Low-level utilities for custom validation flows:

```js
const { mapZodError } = require('cds-validate');

// Use in your own validation logic
const result = MySchema.safeParse(data);
if (!result.success) {
  const capError = mapZodError(result.error);
  req.error(capError); // → OData 422 response
}
```

---

## 🌍 Real World Examples

<details>
<summary><b>🏢 Enterprise CRUD — Validate all entities in a loop</b></summary>

```js
const { validate, schemaFromEntity } = require('cds-validate');

module.exports = async (srv) => {
  const entities = ['Employees', 'Departments', 'Projects', 'Tasks', 'Timesheets'];

  for (const entity of entities) {
    const schema = await schemaFromEntity(entity);
    srv.before('CREATE', entity, validate(schema));
    srv.before('UPDATE', entity, validate(schema));
  }
  // That's 10 validation handlers in 5 lines of code!
};
```

</details>

<details>
<summary><b>🔌 API Gateway — Strict validation for external payloads</b></summary>

```js
const ExternalPayloadSchema = z.object({
  transactionId: z.string().uuid(),
  amount:        z.coerce.number().positive(),
  currency:      z.enum(['USD', 'EUR', 'GBP', 'INR']),
  timestamp:     z.string().datetime(),
  metadata:      z.record(z.string()).optional(),
});

// Strict mode: reject any unknown fields from external clients
srv.before('CREATE', 'ExternalTransactions',
  validate(ExternalPayloadSchema, { strict: true })
);
```

</details>

<details>
<summary><b>📊 Fiori Elements — Field-level errors that UI5 understands</b></summary>

```js
// Fiori Elements reads OData error.details[].target to highlight fields
const InvoiceSchema = z.object({
  vendorId:    z.string().uuid('Please select a valid vendor'),
  amount:      z.coerce.number().positive('Amount must be positive'),
  invoiceDate: z.string().min(1, 'Invoice date is required'),
});

srv.before('CREATE', 'Invoices', validate(InvoiceSchema));
// → Fiori automatically shows red borders on invalid fields!
```

</details>

<details>
<summary><b>🔧 Custom Actions — Validate bound action parameters</b></summary>

```js
const ApproveParams = z.object({
  orderId:     z.string().uuid(),
  approverNote: z.string().max(500).optional(),
  priority:    z.enum(['low', 'medium', 'high']).default('medium'),
});

srv.before('approveOrder', validateParams(ApproveParams));
```

</details>

<details>
<summary><b>📡 Pagination Guard — Prevent expensive queries</b></summary>

```js
const ReadGuard = z.object({
  $top:     z.coerce.number().max(100, 'Maximum 100 records per request').optional(),
  $skip:    z.coerce.number().min(0).optional(),
  $orderby: z.string().optional(),
});

// Clients can't request 10,000 records at once anymore
srv.before('READ', 'LargeDataSet', validateQuery(ReadGuard));
```

</details>

<details>
<summary><b>🔀 Mixing auto-generated + custom schemas</b></summary>

```js
module.exports = async (srv) => {
  // Start from CDS model...
  const baseSchema = await schemaFromEntity('Students');

  // ...then extend with custom business rules
  const strictSchema = baseSchema.extend({
    email: z.string().trim().toLowerCase().email(),
    gpa:   z.coerce.number().min(0).max(4),
  });

  srv.before('CREATE', 'Students', validate(strictSchema));
};
```

</details>

<details>
<summary><b>🔁 Conditional validation with Zod refinements</b></summary>

```js
const OrderSchema = z.object({
  type:         z.enum(['standard', 'express', 'overnight']),
  amount:       z.coerce.number().positive(),
  deliveryDate: z.string().datetime().optional(),
}).refine(
  (data) => data.type !== 'express' || data.deliveryDate != null,
  { message: 'Express orders require a delivery date', path: ['deliveryDate'] }
);
```

</details>

---

## 🧪 Error Response Format

All errors follow the [OData JSON error format](https://docs.oasis-open.org/odata/odata-json-format/v4.01/odata-json-format-v4.01.html#sec_ErrorResponse) — compatible with SAP Fiori, UI5, and any OData client:

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
      { "message": "Name is required",        "target": "name" },
      { "message": "Invalid email format",     "target": "email" },
      { "message": "Number must be at most 4", "target": "gpa" }
    ]
  }
}

// Nested field error (e.g., address.zipCode)
{
  "error": {
    "code": 422,
    "message": "Zip must be 5 characters",
    "target": "address/zipCode",          // ← OData path syntax
    "details": [
      { "message": "Zip must be 5 characters", "target": "address/zipCode" }
    ]
  }
}
```

---

## ❓ FAQ

<details>
<summary><b>Q: Does this work with CAP Java?</b></summary>

No — `cds-validate` is designed for the **CAP Node.js** runtime. For CAP Java, consider using Bean Validation (JSR 380) with `@Valid` annotations.
</details>

<details>
<summary><b>Q: Does this replace CDS annotations like <code>@mandatory</code>?</b></summary>

It **complements** them. CDS `@mandatory` enforces constraints at the database level. `cds-validate` enforces them at the **application level** with richer rules (regex, ranges, custom messages) and returns user-friendly OData error responses before the request reaches the database.
</details>

<details>
<summary><b>Q: Will this slow down my API?</b></summary>

Zod parsing is extremely fast — typically **< 1ms** for objects with 10-20 fields. The overhead is negligible compared to database operations. In most cases, validation **saves** time by rejecting bad requests before they hit the DB.
</details>

<details>
<summary><b>Q: How does UPDATE partial validation work?</b></summary>

When `req.event` is `UPDATE` or `PATCH`, `cds-validate` automatically calls `schema.partial()` before parsing. This makes **all fields optional**, so sending `{ name: "New Name" }` won't fail with "email is required." But any fields you **do** send are still fully validated.
</details>

<details>
<summary><b>Q: Can I use this with <code>cds.run()</code> or programmatic service calls?</b></summary>

Yes! `validate()` works in `srv.before()` handlers. Any call that triggers the `before` event — whether from HTTP, `cds.run()`, or `srv.emit()` — will be validated.
</details>

<details>
<summary><b>Q: Can I extend an auto-generated schema?</b></summary>

Absolutely. Use Zod's `.extend()` or `.merge()`:

```js
const base = await schemaFromEntity('Students');
const custom = base.extend({
  email: z.string().trim().toLowerCase().email(),
  gpa: z.coerce.number().min(0).max(4),
});
```
</details>

<details>
<summary><b>Q: What if my CDS model has a type not in the mapping table?</b></summary>

Unknown types map to `z.any()` — this means they accept any value and never crash your app. You can then override that field in your schema if needed.
</details>

---

## 🗂️ Repository Structure

```
cds-validate/
├── .github/workflows/
│   └── ci.yml                     CI/CD: lint → test (Node 18/20/22) → build → publish
├── packages/
│   └── cds-validate/              The npm package
│       ├── src/
│       │   ├── index.ts               Public API entry point
│       │   ├── types.ts               TypeScript interfaces
│       │   ├── validator.ts           validate(), validateQuery(), validateParams()
│       │   ├── error-mapper.ts        ZodError → OData 422 errors
│       │   └── schema-builder.ts      CDS model → Zod schema
│       ├── tests/
│       │   ├── error-mapper.test.ts   8 tests
│       │   ├── validator.test.ts      16 tests
│       │   └── schema-builder.test.ts 32 tests
│       ├── README.md                  Detailed API documentation
│       ├── CHANGELOG.md               Version history
│       ├── PUBLISHING_GUIDE.md        npm publishing guide
│       └── LICENSE                    MIT
├── demo-app/                      Example CAP app for testing
├── package.json                   Monorepo root
└── pnpm-workspace.yaml            pnpm workspace config
```

---

## 🔄 Version History

| Version | Date | Highlights |
|---------|------|------------|
| **1.0.0** | 2026-04-16 | 🎉 Initial release |

**Full changelog:** [CHANGELOG.md](./packages/cds-validate/CHANGELOG.md)

### Versioning

This project follows [Semantic Versioning](https://semver.org/):

- **Patch** (`1.0.x`) — Bug fixes
- **Minor** (`1.x.0`) — New features, backwards compatible
- **Major** (`x.0.0`) — Breaking API changes

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

```bash
# Clone and setup
git clone https://github.com/Nagarjundas1994-AiAgents/cds-validate.git
cd cds-validate
pnpm install

# Development
cd packages/cds-validate
pnpm test              # Run 56 tests
pnpm test:watch        # Watch mode
pnpm test -- --coverage  # Coverage report
pnpm lint              # TypeScript type-check
pnpm build             # Compile to dist/
```

### Workflow

1. 🍴 Fork the repository
2. 🌿 Create a feature branch: `git checkout -b feature/my-feature`
3. ✅ Write tests first, then implementation
4. 🧪 Ensure all tests pass: `pnpm test`
5. 📤 Submit a Pull Request

---

## 📄 License

[MIT](./packages/cds-validate/LICENSE) — free for personal and commercial use.

---

<div align="center">

**Built with ❤️ for the SAP CAP community**

If `cds-validate` saved you time, consider giving it a ⭐!

<br/>

[🐛 Report Bug](https://github.com/Nagarjundas1994-AiAgents/cds-validate/issues) •
[💡 Request Feature](https://github.com/Nagarjundas1994-AiAgents/cds-validate/issues) •
[📦 npm Package](https://www.npmjs.com/package/cds-validate)

</div>
