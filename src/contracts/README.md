# Shared runtime contracts

**Shared ownership:** Persons 1, 2, and 3

This folder contains the runtime-validated schemas and TypeScript types shared across team boundaries. They must match `TEAM_CONTRACT.md`.

- `common.ts` contains small values reused by multiple contracts.
- `risk.ts` contains risk decision and persisted RiskAssessment shapes.
- `memory.ts` contains MemoryItem, profile snapshot, and mutation proposal shapes.
- `escalation.ts` contains Person 3's escalation-generation result.
- `ai.ts` contains the input and output boundary between Person 2's backend and Person 3's processing pipeline.
- `index.ts` exports the public contract surface.

Use the Zod schemas to check untrusted data at runtime. Import the inferred TypeScript types for compile-time checks. Shared names or behavior must be changed in `TEAM_CONTRACT.md` before these files are changed.
