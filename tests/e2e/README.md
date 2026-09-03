# End-to-end tests

**Shared ownership:** Persons 1, 2, and 3

The final manual connected check follows `docs/SUPABASE_SETUP.md`: acquisition → guest value → verified patient → healthcare consent → conversion → patient message → Living Profile → escalation → nurse queue. Automated browser coverage is deferred until a repeatable local Supabase runtime is available; unit/integration tests own the deterministic challenge build.
