# Living Memory

**Owner:** Person 3

This module proposes structured, provenance-aware, append-only MemoryItem mutations. It does not write to the database.

- `normalize-memory.ts` creates stable comparison values and removes duplicates.
- `deterministic-extraction.ts` covers the required common medication, allergy, symptom, timeline, and chief-complaint examples without an LLM.
- `extract-memory.ts` accepts only a successful RedactionResult. It validates strict model JSON and falls back to deterministic extraction on provider failure or invalid output.
- `mutate-memory.ts` compares candidates with the current profile, skips duplicates, and creates correction proposals using `supersedes_memory_item_id`.

Every mutation proposal points to the current patient message through `provenance_pointer`. Person 2 validates authorization and persists accepted proposals as new MemoryItem rows; old rows remain available as history.
