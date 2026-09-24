# App basics checklist

A short list of things worth building into any app, not just this one —
questions worth asking before something new ships, not a rulebook to follow
blindly. See the plant-detail-page error boundaries (#227) for a concrete
example of #1 in this repo.

- [ ] **Contain failures.** If one part of the screen breaks, does the whole
  app go down with it, or does just that part fail quietly? One broken
  section shouldn't take out navigation or unrelated data.
- [ ] **Don't trust data from outside the app.** A file import, a form
  field, another service's response — check it before building on it,
  don't assume it's shaped the way you expect.
- [ ] **Make destructive actions hard to do by accident.** Delete, clear,
  overwrite — ask "are you sure?" first.
- [ ] **Wall off one person's data from everyone else's.** If the app has
  more than one user, a bug in the code should never be able to show
  Person A something that belongs to Person B.
- [ ] **Test the code that reasons, not the code that just draws pixels.**
  Anything doing math, decisions, or scoring is worth a real test. A CSS
  tweak usually isn't.
- [ ] **See your own errors, eventually.** Once there are real users
  besides you, a bug should reach you somewhere you'll notice (e.g.
  Sentry) — not just sit in a browser console nobody's looking at. Not
  needed on day one; worth doing before real users show up.

Not exhaustive, and not every item applies to every project — a one-person
local tool doesn't need multi-user data walls. Treat it as a prompt to
think it through, not a box-ticking exercise.
