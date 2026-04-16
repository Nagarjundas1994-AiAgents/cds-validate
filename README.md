<div align="center">

# 🛡️ cds-validate

**Zod-powered validation middleware for SAP CAP**

[![npm version](https://img.shields.io/npm/v/cds-validate?style=for-the-badge&color=CB3837&logo=npm&logoColor=white)](https://www.npmjs.com/package/cds-validate)
[![license](https://img.shields.io/npm/l/cds-validate?style=for-the-badge&color=blue)](./packages/cds-validate/LICENSE)
[![tests](https://img.shields.io/badge/tests-56%20passed-brightgreen?style=for-the-badge&logo=jest&logoColor=white)](./packages/cds-validate/tests)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SAP CAP](https://img.shields.io/badge/SAP_CAP-7.0+-0FAAFF?style=for-the-badge&logo=sap&logoColor=white)](https://cap.cloud.sap/)

<br/>

Stop writing 50 lines of `if`-checks in every CAP handler.<br/>
**One line. One schema. Done.**

</div>

---

## ⚡ Before & After

```js
// ❌ Before — fragile, verbose, unmaintainable
srv.before('CREATE', 'Students', (req) => {
  if (!req.data.name) req.error(400, 'Name is required');
  if (!req.data.email) req.error(400, 'Email is required');
  if (req.data.email && !req.data.email.includes('@')) req.error(400, 'Invalid email');
  if (req.data.gpa && typeof req.data.gpa !== 'number') req.error(400, 'GPA must be number');
  if (req.data.gpa && (req.data.gpa < 0 || req.data.gpa > 4)) req.error(400, 'GPA 0-4');
  // ... and 20 more lines per entity ...
});
```

```js
// ✅ After — one line, type-safe, auto-coercion, OData-compliant errors
srv.before('CREATE', 'Students', validate(StudentSchema));
```

---

## 📦 Install

```bash
npm install cds-validate zod
```

## 🚀 Quick Start

```js
const { validate } = require('cds-validate');
const { z } = require('zod');

const StudentSchema = z.object({
  name:  z.string().min(1, 'Name is required'),
  email: z.string().trim().email('Invalid email'),
  gpa:   z.coerce.number().min(0).max(4).optional(),
});

module.exports = (srv) => {
  srv.before('CREATE', 'Students', validate(StudentSchema));
  srv.before('UPDATE', 'Students', validate(StudentSchema)); // auto-partial!
};
```

Or skip writing schemas entirely — auto-generate from your CDS model:

```js
const { schemaFromEntity, validate } = require('cds-validate');

module.exports = async (srv) => {
  const StudentSchema = await schemaFromEntity('Students');
  srv.before('CREATE', 'Students', validate(StudentSchema));
};
```

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🛡️ **Schema Validation** | Validate `req.data`, `req.query`, and `req.params` with Zod |
| 🔄 **Auto-Partial on UPDATE** | Missing fields are allowed on UPDATE/PATCH automatically |
| 🎯 **Type Coercion** | `"3"` → `3`, trims whitespace, normalizes data — for free |
| 📋 **OData Error Format** | Returns proper HTTP 422 errors with field-level details |
| 🏗️ **Auto-Schema Generation** | Build Zod schemas from your CDS model — zero manual work |
| 📦 **Zero Config** | Works out of the box with any CAP project |
| 🔒 **TypeScript First** | Full type definitions included |

---

## 📖 Full Documentation

📄 **[Full API Reference & Documentation →](./packages/cds-validate/README.md)**

Includes: detailed API reference, all use cases, architecture diagram, advanced examples, CDS type mapping table, and more.

---

## 🗂️ Repository Structure

```
├── packages/
│   └── cds-validate/          ← The npm package
│       ├── src/
│       │   ├── index.ts           Entry point — re-exports public API
│       │   ├── types.ts           TypeScript interfaces
│       │   ├── validator.ts       validate(), validateQuery(), validateParams()
│       │   ├── error-mapper.ts    ZodError → OData 422 error format
│       │   └── schema-builder.ts  Auto-build Zod from CDS entities
│       ├── tests/                 56 tests (Jest + ts-jest)
│       ├── README.md              Full API documentation
│       ├── CHANGELOG.md           Version history
│       └── PUBLISHING_GUIDE.md    Local testing & npm publish guide
├── demo-app/                  ← Example CAP app for testing
├── .github/workflows/
│   └── ci.yml                 ← CI/CD: lint → test → build → publish
├── package.json               ← Monorepo root
└── pnpm-workspace.yaml        ← pnpm workspace config
```

---

## 🧪 Error Response Example

```json
{
  "error": {
    "code": 422,
    "message": "Validation failed with 2 errors",
    "target": "email",
    "details": [
      { "message": "Invalid email format", "target": "email" },
      { "message": "Number must be at most 4", "target": "gpa" }
    ]
  }
}
```

---

## 🔄 Version History

| Version | Date | Highlights |
|---------|------|------------|
| **1.0.0** | 2026-04-16 | 🎉 Initial release — `validate()`, `validateQuery()`, `validateParams()`, `schemaFromEntity()`, `mapZodError()`, `cdsTypeToZod()`. 56 tests. |

---

## 🤝 Contributing

```bash
git clone https://github.com/Nagarjundas1994-AiAgents/cds-validate.git
cd cds-validate
pnpm install
cd packages/cds-validate
pnpm test           # 56 tests
pnpm lint           # TypeScript type-check
pnpm build          # Compile to dist/
```

---

## 📄 License

[MIT](./packages/cds-validate/LICENSE) — use freely in personal and commercial projects.

---

<div align="center">

**Built with ❤️ for the SAP CAP community**

⭐ Star this repo if it saved you time!

</div>
