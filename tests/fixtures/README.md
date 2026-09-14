# Bootstrap regression fixture

`legacy-simulation-results.json` is a frozen input for tests of the supported bootstrap-artifact format without replay metadata. The unit suite checks its byte digest, absent replay fields, and fixed early-p-value vector. Its descriptive strings are preserved as part of that test input.

Current audit findings and method descriptions are in [AUDIT_CONTEXT.md](../../AUDIT_CONTEXT.md) and the reports under `outputs/`. The fixture is not used as the current simulation report. Its original bootstrap random inputs are not available; the digest test establishes byte identity, not the generation of its p-values.
