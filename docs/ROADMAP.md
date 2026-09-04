# Roadmap

Ordered outcomes for the fork. Each phase is a reviewable unit: it lands on its own
branch off `port-v0.10.26`, passes the gate in `CLAUDE.md`, and is verified in-game
before the next one starts.

Status legend: `todo` / `in progress` / `done` / `blocked`.

---

## Phase 1 — Project instructions and skills · done

**Outcome.** The repository carries its own operating instructions, so a session
starts with the build/test gate, the "never guess a game API" rule, and the wiring
rules already known.

Delivered: `CLAUDE.md`, `.claude/skills/{automation-module,automation-focus,ephenia-script,desktop-release}/SKILL.md`,
`.claude/settings.json`, this file.

Adapted from `ChrisTitusTech/titus-ai` in the shape already used on
`YggdrasziI/mutant_turtles`: operating principles folded into `CLAUDE.md`, domain
skills under `.claude/skills/`, and none of the Codex-specific layout (`.agents/`,
`codex-home/`, `codex-plugins.txt`, `agents/openai.yaml`).

**Validation.** Every path and line number cited in the skills still resolves.

---

## Phase 2 — Repository independence · done

**Outcome.** Nothing in the repository points at the upstream account for updates.
Until this lands, an update check can overwrite local work with the upstream copy.

**Scope.**

1. `git remote set-url origin https://github.com/YggdrasziI/Pokeclicker-Scripts.git`
2. 22 userscripts — `@copyright`, `@homepageURL`, `@supportURL`, `@downloadURL`,
   `@updateURL` (lines 6 and 10-13; `custom/autosafarizone.user.js` at 13-16).
   `@author` is attribution and does not change.
3. `desktopupdatechecker.js:13` — the URL appears twice, as `href` and as text.
4. `custom/infiniteseasonalevents.user.js:234` — link shown in-game.
5. `README.md` — 43 lines: shields badges, and the `/blob/` + `/raw/` pair in every
   script section. `user-images.githubusercontent.com` images are
   account-independent and stay.
6. `desktop/app_src/src/main.js:934` — the `repoUrl` every script download goes
   through. Plus the log strings at `:966` and `:973`.
7. Repack `desktop/app.asar` (see the `desktop-release` skill).
8. `automation/build.mjs:61,62,66,67` — the upstream automation links become this
   repository's, and add the missing `@downloadURL` / `@updateURL`: the Automation
   bundle currently has no auto-update path at all.

**Acceptance criteria.**

- `git grep -in "Ephenia/Pokeclicker-Scripts"` is empty.
- `git grep -in "ephenia"` returns only the shared ABI (`loadEpheniaScript`,
  `epheniaScriptInitializers`, `AutomationEpheniaControls`, `ephenia-mirror-*`,
  `epheniaControls-*`, `epheniaSettings-*`) and `@author` lines. Renaming any of
  those breaks compatibility with every Ephenia script published elsewhere.
- `desktop/app.asar` contains the new `repoUrl`.

**Manual validation.** Launch the desktop client; the script manager logs
`Found script files in YggdrasziI/Pokeclicker-Scripts/` and lists the scripts.

**Known follow-up, not fixable by substitution.** Three screenshots hosted as
upstream repository assets (`README.md:98,243,324`, `desktop/README.md:22`) must be
re-uploaded by hand.

---

## Phase 3 — Quick wins · done

| Outcome | Target | What was done |
| --- | --- | --- |
| Gem upgrades complete `Immune` first | `automation/lib/Items.js` | The planned fix was wrong: `TypeEffectiveness.Immune` is already 0, so the old loop *did* reach it first. The real problem was that it bought one level of every affinity per tick, spreading a type's gems evenly. It now walks an explicit priority list and stops at the first affinity of that type which is not maxed — including when it cannot afford it, so gems accumulate for it instead of leaking into lower-priority upgrades. Types never compete, each has its own wallet. |
| Additional Visual Settings laid out vertically | `additionalvisualsettings.user.js` | The per-state `<td>` became `flex-direction: column`, and each row a `d-flex justify-content-between` so the checkboxes line up. |
| Remaining evolution count on hover | `automation/lib/Trivia.js` | `__internal__hasStoneEvolutionCandidate` became `__internal__getStoneEvolutionCandidateCount`. The stone images are now built through the DOM rather than concatenated HTML, so the tooltip separator's line breaks survive into the attribute. The refresh cache key carries the counts, otherwise a changed count would not redraw. The existing lock-reason filter is unchanged — region and time-of-day locks count, others do not. |
| Auto-quest watchdog | `automation/lib/Focus/Quests.js` | New `Focus-Quests-StuckRefreshMinutes`, 0 (off) by default. `__internal__claimCompletedQuests` stamps the time; `__internal__refreshQuestsIfStuck` runs from the loop's working branch and calls `App.game.quests.refreshQuests()` past the delay. It does **not** reuse `__internal__skipRemainingQuests` as planned: that one diverts to money farming when a refresh is unaffordable, which would abandon a quest the automation is actively working on. Here an unaffordable refresh is simply retried next tick. Note `refreshQuests()` quits every quest in progress — the tooltip says so. |

**Acceptance criteria.** Each option defaults to off; the watchdog threshold persists
across a reload; the gem loop still self-disables once everything is maxed.

**Validation.** `node automation/build.mjs && cd automation/test && npm test` — 68
checks pass. In-game validation still pending: leave auto-quest running with every
quest type disabled and confirm the refresh fires once, not in a loop; hover a stone
in the Trivia panel; check that a type's gems now pile up toward its Immune upgrade
instead of being spread.

---

## Phase 4 — Farming, Battle Café, shop shortcut · todo

**Farm Points efficiency mode.** New option in `automation/lib/Farm.js`, mutually
exclusive with `FocusOnUnlocks` (which returns early at `:403-418`). The yield
formula already exists in `automation/lib/Focus/Quests.js:828-863` (`farmValue` over
`growthTime[PlotStage.Bloom]`) but is written for a fixed quest target; here it has
to maximise FP/hour in steady state over unlocked berries and available plots.

**Auto Battle Café.** `automation/lib/Instances/BattleCafe.js` is an information
overlay today — no settings, no loop, no berry use. Add an On/Off button inside its
floating category (`automation/lib/Instances/Safari.js:149-159` is the reference for
a button inside a floating category), and a loop that spends `spinsLeft` on uncaught
Alcremie forms, picking duration and direction from `BattleCafeController.evolutions`.

When the berries a sweet needs are missing, request them from the farm through
`Automation.Farm.ForcePlantBerriesAsked`. **That field has exactly one writer today**
(`Focus/Quests.js`, at `:189-212` and `:501-522`). Adding a second one requires an
explicit arbitration rule, or the quest focus and the café will fight over the farm.

**Shops shortcut.** `additionalvisualsettings.user.js:152-197`. A direct analogue of
the existing Gyms and Dungeons shortcuts: a button on `#townMap`, a
`shopsShortcutModal` inserted after `#ShipModal`, and a `generateRegionShopsList()`
walking `TownList` filtered to `Shop` instances — the same filter
`automation/lib/Shop.js:506` already uses.

**Acceptance criteria.** FP mode and unlock mode cannot both be active. The café
stops cleanly when spins run out and releases any farm request. The shops modal
lists only reachable shops in the current region.

---

## Phase 5 — Vitamins, helpers, Mystery Mine · todo

**Auto-protein and balancing.** `additionalvisualsettings.user.js:407` already
defines `PartyPokemon.prototype.optimizeVitamins`, and `:393` the breeding-efficiency
model it optimises. The new feature distributes vitamins via `useVitamin(type, n)` up
to a target, capped by what the player owns. Two modes: a fixed count per Pokémon,
and levelling everyone to the same tier.

**Auto helpers.** Greenfield — the library has no helper code at all today. Hire and
release `HatcheryHelpers` (game cap `MAX_HIRES = 3`; the cost is charged **per hatch**
by `charge()`, which fires the helper automatically when funds run out) and
`UndergroundHelpers` (consume energy potions). The requested rule — hire only while
resource generation exceeds consumption — means measuring throughput over a sliding
window before hiring and re-evaluating on a timer, not a one-shot check. Option for
the maximum number of helpers, 1 to 4; note the game itself caps the hatchery at 3.

**Mystery Mine.** No injection into `UndergroundHelpers.list` — decided. Instead an
option in `Automation > Mining` that forces `MineType.Special` ("Mystery Mine", the
only mine that yields Mega Stones; `MineType.Random` explicitly excludes them) while
Mega Stones remain unobtained, using Cynthia's sprite. The mine-type dropdown at
`automation/lib/Underground.js:183` is hard-coded to six types and needs `Special`
added.

**Acceptance criteria.** No vitamin is spent below the configured floor. A helper is
never hired when the measured net rate is negative. Mining returns to the chosen mine
type once no Mega Stones remain.

---

## Phase 6 — In-game time and weather · todo

New `custom/simpletimechanger.user.js`, modelled on
`custom/simpleweatherchanger.user.js` — the same shape: a `<select>`, a
`localStorage`-backed choice, a monkey-patch on the time source, and a "follow the PC
clock" default.

Then group both controls in the Automation "Ephenia scripts" card. Blocker to solve
first: `automation/lib/EpheniaControls.js:165-207` can only mirror on/off buttons
carrying `btn-success` / `btn-danger`. A `<select>` needs a new path — proxy `value`
and dispatch a `change` event on the source select — and the weather selector, which
currently lives on `#townMap` (`custom/simpleweatherchanger.user.js:31-38`), has to
move.

**Acceptance criteria.** Both selectors work from the card and from their original
location; the weather script keeps working with the Automation bundle absent.

---

## Phase 7 — Focus fallback order · todo

The only change here that is a real rework.

**Problem.** A focus topic has no way to say "I am blocked". It calls
`Menu.forceAutomationState(Focus.Settings.FeatureEnabled, false)` plus a warning
notification, and everything stops — `Focus.js:67`, `Focus.js:197`,
`Focus/Achievements.js:256`, `Focus/PokerusCure.js:174`,
`Focus/ShadowPurification.js:131`. There is no priority chain, no queue, no watchdog;
`__internal__activeFocus` is a singleton.

**Approach.**

1. Introduce a `Blocked` outcome a `run()` can return — a reason, and optionally a
   retry delay — instead of killing the feature.
2. Convert those five self-disable sites to report `Blocked`. Turning the feature off
   stays as the last resort, for when the entire chain is blocked.
3. Add a reorderable fallback list to the focus settings "General" tab, persisted as
   `Focus-FallbackOrder`.
4. Supervisor in `Focus.js:376-421`: on `Blocked`, call the current topic's `stop()`,
   move to the first unblocked topic in the chain, and periodically re-test the chosen
   topic to return to it as soon as it becomes possible again.
5. The dropdown stays the source of truth for the *wanted* topic; the chain only
   describes fallbacks.

**Risk.** `Focus/Quests.js:162-184` seizes Click, Hatchery, Underground and Farm and
releases them in `__internal__stop()` (`:217-248`). Every automatic switch must go
through `stop()`. Short-circuiting it leaves those features force-enabled and
disabled-in-the-UI with no owner.

**Acceptance criteria.** A topic that runs out of work hands over instead of turning
the feature off. The chain survives a reload. Returning to the preferred topic happens
without user action. Quests never leaves another feature stranded.

**Manual validation.** Select Pokérus Cure with everything already cured and confirm
the handover, then confirm the return once a new candidate appears.
