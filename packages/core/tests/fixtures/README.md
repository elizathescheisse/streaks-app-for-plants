# Scenario fixtures

Real-data bug repros saved as plant JSON snapshots. Each fixture captures the
minimum event sequence needed to reproduce a bug observed in the wild, and is
paired with one or more assertions in `tests/scenarios.test.js`.

## Why

When a bug surfaces in real data (chart looks wrong, recommendation makes no
sense, prediction is bizarre), the fastest way to encode "this should never
happen again" is to save the offending plant's events and assert the
user-observable outcome — not just patch the underlying selector with a unit
test that may or may not exercise the same code path.

See issue #103 for the full rationale.

## Fixture format

A single plant object — same shape as one entry in the exported `plants` array,
trimmed to the events needed to reproduce. Filename convention:

```
<plant-or-species>-YYYY-MM-DD-<short-tag>.json
```

e.g. `alocasia-2026-05-20-probe-variance.json`.

## Adding a new fixture

1. Reproduce the bug. Export the affected plant's JSON or hand-craft a minimal
   event sequence.
2. Save it here with the naming convention above.
3. Add a `describe` block in `tests/scenarios.test.js`:
   - Load the fixture
   - Assert the user-observable property that was wrong (e.g. moisture display,
     recommendation amount, predicted value)
   - Add a comment linking to the issue and/or PR
4. Make sure the test would FAIL without the fix.

## Fixtures

| File | Issue | Notes |
|------|-------|-------|
| `alocasia-2026-05-20-probe-variance.json` | #101 | Reading 3 → water 2c → reading 2 (dry-pocket probe) → reading 6 (good probe). Should not recommend re-watering. |
| `big-monstera-2026-05-28-noisy-dip.json` | #172 | Mid-cycle readings 5 → 2 → 4 with no watering between (probe dip). Fitted line stays near the neighbor consensus, only slightly pulled down. |
