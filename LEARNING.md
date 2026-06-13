# Eliza's learning journal

A rough compass for where I'm at and how I'm growing — Claude maintains this as we build.

**How to read it:** levels are an approximate *direction*, not a grade or a test score. They're inferred from how our sessions go, so they're fuzzy — correct anything that feels off; it's mine to own. The point is to (1) see progress over time and (2) know where to focus.

**The big reframe:** "understanding code" isn't one skill — it's several, and they're at different levels. Lumping them together is what makes code feel "impossible." Broken apart, the gaps are specific and fillable, and the hardest one (writing from scratch) is the one I need least.

## Skill levels

Scale: **1** brand new · **2** beginner · **3** comfortable · **4** strong · **5** expert

| Skill | Level | Most recent evidence | Next milestone |
|---|---|---|---|
| Systems / product reasoning | **4** | Proposed regression to de-noise the slope; designed the watering feedback-loop in plain language; caught bandaid-vs-root-cause; made scope/sequencing calls. | Keep applying it to new problem types. |
| Software / product vocabulary | **3** | Knows `idempotent`, PRs, branches, localStorage; product-fluent. | Bank a few architecture terms (component, state, prop, selector). |
| Math / stats vocabulary | **2 ↑** | Learned α/β, regression, slope, residual, EMA, R², bias-vs-noise this session. | Recognize these without a reminder when they come up. |
| Code reading (what a snippet does) | *not yet measured* | Follows plain-English line-walkthroughs well. | Read 2–3 real lines per PR and predict what they do before I explain. |
| Code architecture (how pieces connect) | *not yet measured* | — | Build a mental map of this app's main files over a few PRs. |
| Writing code from scratch | *not exercised* | — | Optional / lowest priority — don't let this define "can I code." |

## What comes easily vs. what's hard (and why)

- **Comes easily:** judgment, systems thinking, knowing what you want, spotting bad logic, design tradeoffs. (The genuinely hard-to-teach stuff.)
- **Feels hard:** math notation/symbols (a *different field's* dialect, not engineering), and the leap from "I understand the concept" to "I can see it in the actual code."
- **Why it feels impossible:** aiming at the hardest sub-skill (writing from scratch) and concluding "I can't code." The leverage is in *reading* + the *map*, where you're already capable at the idea level.

## Where to focus (highest leverage first)

1. **Code reading** — follow what real lines do, in context, one small piece at a time.
2. **The architecture map** — slowly learn how this app's files/functions connect (build it up across PRs).
3. **Vocabulary** — keep banking handles in the glossary; they make everything else cheaper.
4. *(Deprioritized)* writing from scratch — only if/when you want it.

## Log (dated snapshots)

- **2026-06-13** — Initial read. Reasoning is the standout (4). Vocabulary split: software ~3, math/stats ~2 but visibly climbing (learned 6+ stats concepts in one session — strong evidence the "I can't learn this" story is false). Code reading/architecture not yet measured because the role so far has been *directing* (Claude writes, Eliza decides) — we'll start building that evidence via teacher-mode walkthroughs.
