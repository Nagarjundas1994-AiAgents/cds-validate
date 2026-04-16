# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-04-16

### Added

- `validate(schema, options?)` — middleware to validate `req.data` against a Zod schema
- `validateQuery(schema, options?)` — middleware to validate `req.query` (OData query params)
- `validateParams(schema, options?)` — middleware to validate `req.params` (action parameters)
- `schemaFromEntity(entityName, options?)` — auto-build Zod schemas from CDS entity definitions
- `mapZodError(zodError)` — convert ZodError to OData-compatible error format (HTTP 422)
- `cdsTypeToZod(element)` — map individual CDS types to Zod types
- Auto-partial on UPDATE/PATCH events (`schema.partial()` applied automatically)
- Type coercion and data normalization via Zod transforms
- Full TypeScript type exports
- Comprehensive test suite (56 tests)
