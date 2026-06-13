# Notes to self

- Use `gh <description>` to file a GitHub issue — no need to ask Claude to do it
- After merging a PR, tell Claude immediately so it pulls main and cleans up local branches
- Before filing a new GitHub issue, check if a similar one already exists

## Sticky notes

- **Water the fiddle leaf fig and monsteras to drainage** — next time you water, go until water runs out the bottom and note: (1) how many cups it took, and (2) what moisture reading you get right after. This will give real data on what the post-watering max actually is for those specific pots, and help calibrate when the app is over-recommending water amounts.

## Glossary (plain-English handles for terms that come up)

*Claude keeps this updated — one line, everyday words, whenever a real term shows up.*

- **α (alpha)** — how much one cup of water raises the moisture reading. (Math/stats, not engineering.)
- **β (beta)** — how fast the soil dries, in moisture points per day.
- **regression / regression line** — drawing the single best straight line through scattered dots to find the underlying trend; its steepness is the "slope."
- **slope** — how steep the line is; here, the drying speed.
- **residual** — the gap between what the model predicted and what you actually measured (predicted 3, measured 5 → residual +2).
- **EMA (exponential moving average)** — a running average that weights recent readings more than old ones, so it adapts to change instead of being anchored to stale data.
- **R² (r-squared)** — how well the line actually fits the dots: 1 = perfect fit, near 0 = scattered noise.
- **feedback loop / "thermostat"** — a system that watches the result, compares it to a goal, and adjusts again and again until it settles on the right value.
- **bias vs. noise** — bias = consistently wrong in one direction (fixable by correcting); noise = scattered randomly both ways (not fixable, just genuine unpredictability).
- **confidence (of the model)** — how much real data it has to go on; low confidence = still mostly guessing from defaults.

## Parked work

- **PR #87 / branch `feature/inline-timeline-expand`** — replaces the two-view toggle with a single focus view + inline accordion timeline per card. Parked because the card action buttons got cluttered (▼ Timeline + 💧 + ◎ + Log = too many). The design decision needed before resuming: reduce card to 3 actions max (💧, ◎, ▼ Timeline) and move + Log into the expanded section. I think creating the full card details page will resolve some of this. Reopen the PR after creating that page and when ready to pick this back up.
