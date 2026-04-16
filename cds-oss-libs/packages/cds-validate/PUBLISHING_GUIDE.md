# Local Testing & npm Publishing Guide

## Prerequisites

Before starting, make sure you have these tools installed:

```bash
# Check versions
node -v    # v18+ required
pnpm -v    # v8+ required (install via: npm i -g pnpm)
```

---

## Part 1: Local Development & Testing

### 1.1 Clone & Install

```bash
cd cds-oss-libs
pnpm install
```

This installs dependencies for all workspace packages (`cds-validate` + `demo-app`).

### 1.2 Run Tests

```bash
# Run all tests
cd packages/cds-validate
pnpm test

# Run tests in watch mode (re-runs on file change)
pnpm test:watch

# Run tests with coverage report
pnpm test -- --coverage
```

You should see all 56 tests pass:

```
PASS tests/error-mapper.test.ts     (8 tests)
PASS tests/validator.test.ts        (16 tests)
PASS tests/schema-builder.test.ts   (32 tests)

Tests:       56 passed, 56 total
```

### 1.3 TypeScript Type-Check

```bash
# Check for type errors without emitting files
pnpm lint
```

This runs `tsc --noEmit` and should produce zero errors.

### 1.4 Build the Package

```bash
# Compile TypeScript → JavaScript into dist/
pnpm build
```

Verify the output:

```bash
# Check that dist/ contains the expected files
ls dist/
# Should see: index.js, index.d.ts, validator.js, error-mapper.js, schema-builder.js, types.js
# Plus corresponding .d.ts and .js.map files
```

### 1.5 Test the Built Package Locally

Before publishing to npm, test it as if you were a consumer:

```bash
# 1. Create a tarball (exactly what npm publish would upload)
cd packages/cds-validate
npm pack

# This creates: cds-validate-1.0.0.tgz

# 2. In your demo-app (or any CAP project), install from the tarball
cd ../../demo-app
npm install ../packages/cds-validate/cds-validate-1.0.0.tgz

# 3. Test the import works
node -e "const v = require('cds-validate'); console.log(Object.keys(v));"
# Should print: [ 'validate', 'validateQuery', 'validateParams', 'mapZodError', 'schemaFromEntity', 'cdsTypeToZod' ]
```

### 1.6 Test with a Real CAP Service

Create a simple test service in `demo-app/`:

**`demo-app/db/schema.cds`**
```cds
namespace demo;

entity Students {
  key ID    : UUID;
  name      : String(100) @mandatory;
  email     : String(200) @mandatory;
  gpa       : Decimal(3,2);
  enrolled  : Boolean;
}
```

**`demo-app/srv/student-service.cds`**
```cds
using demo from '../db/schema';

service StudentService {
  entity Students as projection on demo.Students;
}
```

**`demo-app/srv/student-service.js`**
```js
const { validate } = require('cds-validate');
const { z } = require('zod');

const StudentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().trim().email('Invalid email'),
  gpa: z.coerce.number().min(0).max(4).optional(),
  enrolled: z.boolean().optional(),
});

module.exports = (srv) => {
  srv.before('CREATE', 'Students', validate(StudentSchema));
  srv.before('UPDATE', 'Students', validate(StudentSchema));
};
```

Then run:

```bash
cd demo-app
cds watch
```

Test with curl:

```bash
# Valid request — should succeed
curl -X POST http://localhost:4004/student/Students \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com","gpa":3.5}'

# Invalid request — should return 422
curl -X POST http://localhost:4004/student/Students \
  -H "Content-Type: application/json" \
  -d '{"name":"","email":"not-an-email","gpa":5.0}'
```

---

## Part 2: Preparing for npm Publishing

### 2.1 Create an npm Account

1. Go to [npmjs.com](https://www.npmjs.com/) and create a free account
2. Verify your email address
3. Enable 2-factor authentication (required for publishing)

### 2.2 Verify package.json Fields

These fields are **mandatory** before publishing. They should already be set:

| Field | Value | ✅ |
|---|---|---|
| `name` | `cds-validate` | Set |
| `version` | `1.0.0` | Set |
| `description` | Zod validation middleware for SAP CAP... | Set |
| `main` | `./dist/index.js` | Set |
| `types` | `./dist/index.d.ts` | Set |
| `files` | `["dist", "README.md"]` | Set |
| `license` | `MIT` | Set |
| `keywords` | `["sap", "cap", "cds", "validation"]` | Set |
| `peerDependencies` | `@sap/cds`, `zod` | Set |
| `repository` | GitHub URL | ⚠️ Update with your repo |

> **Important:** Update the `repository.url` field with your actual GitHub repository URL before publishing.

### 2.3 Pre-Publish Checklist

Run these commands and make sure everything passes:

```bash
cd packages/cds-validate

# 1. Type-check
pnpm lint              # ✅ Zero errors

# 2. Tests
pnpm test              # ✅ All 56 tests pass

# 3. Build
pnpm build             # ✅ dist/ created

# 4. Dry-run publish (see what would be uploaded)
npm pack --dry-run     # ✅ Review file list
```

### 2.4 Login to npm

```bash
npm login
# Opens browser — log in with your npm credentials
```

### 2.5 Publish

```bash
cd packages/cds-validate
npm publish --access public
```

> The `--access public` flag is required for scoped packages (`@yourname/cds-validate`). Optional for unscoped packages but good practice.

### 2.6 Verify Publication

```bash
npm info cds-validate
# Should print your package details
```

Visit `https://www.npmjs.com/package/cds-validate` to see it live.

---

## Part 3: Releasing New Versions

### Versioning Strategy (Semver)

| Change | When | Command |
|---|---|---|
| **Patch** (1.0.x) | Bug fixes, no new features | `npm version patch` |
| **Minor** (1.x.0) | New features, backwards compatible | `npm version minor` |
| **Major** (x.0.0) | Breaking API changes | `npm version major` |

### Release Workflow

```bash
# 1. Update CHANGELOG.md with what changed

# 2. Bump version (auto-updates package.json + creates git tag)
npm version patch   # or minor / major

# 3. Publish to npm
npm publish --access public

# 4. Push code + tags to GitHub (triggers CI/CD)
git push && git push --tags
```

### Automated Publishing via CI/CD

The GitHub Actions workflow handles automated publishing. To trigger:

```bash
# Create and push a version tag
git tag v1.0.0
git push --tags
```

The pipeline will:
1. ✅ Type-check
2. ✅ Run tests (Node 18, 20, 22)
3. ✅ Build
4. ✅ Publish to npm (if tag matches `v*`)

**Setup required:** Add your npm token as a GitHub secret:
1. Generate a token: `npm token create`
2. Go to your repo → Settings → Secrets → Actions
3. Add `NPM_TOKEN` with the generated token value

---

## Part 4: Post-Publish Checklist

- [ ] Add npm badge to README: `![npm](https://img.shields.io/npm/v/cds-validate)`
- [ ] Post on [SAP Community](https://community.sap.com)
- [ ] Write a tutorial on [DEV.to](https://dev.to)
- [ ] Submit a PR to the [awesome-cap](https://github.com/niclas-niclas/awesome-cap) list
- [ ] Share on LinkedIn with a demo GIF
