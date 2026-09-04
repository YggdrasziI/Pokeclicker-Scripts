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

## Phase 4 — Farming, Battle Café, shop shortcut · done

**Farm Points efficiency mode.** `Farming-FocusOnFarmPoints` in
`automation/lib/Farm.js`, off by default. Ranks unlocked, in-stock berries by
`farmValue / growthTime[PlotStage.Bloom]` — that index is the age at which a berry
becomes harvestable, which is why the quest optimiser uses it too. The growth
multiplier is left out on purpose: it applies to every berry equally and cannot
change the ranking. The choice is redone every loop, so it follows new unlocks, and
a berry another feature asked for still wins. Mutually exclusive with
`FocusOnUnlocks`: enabling either greys out the other, through one shared
`refreshFocusModeExclusion` that also keeps the existing `HarvestLate` interlock.

**Auto Battle Café.** `BattleCafe-SpinEnabled` in
`automation/lib/Instances/BattleCafe.js`, which until now automated nothing at all.
The loop targets Alcremie forms that are still uncaught **and** reachable at the
current time of day — mirroring `BattleCafeController.unlockAlcremie`, where only a
Dusk counter-clockwise spin over 10 seconds gives the rainbow form and every other
Dusk spin resolves as a day one. Shortest spins are tried first. The one-hour
Milcery (Cheesy) spin is deliberately excluded.

Two notes for later maintenance. `getPrice` and `canSpin` are `private` in the
game's TypeScript, which does not exist at runtime — calling `getPrice` is what makes
the berry request possible, and pre-validating ourselves is what keeps `spin()` from
spamming failure notifications. And `DayCyclePart` is only ever referenced from
TypeScript, so its four values are mirrored locally rather than assumed to be a
global; `DayCycle` itself is one, the game's town map binds `DayCycle.color`.

Farm arbitration, which the plan flagged as needing an explicit rule:
`Automation.Farm.ForcePlantBerriesAsked` is a single-slot channel and the quests
focus writes to it too. **The quests focus wins.** The café claims the channel only
while it is free, steps aside as soon as it sees a value that is not its own, and
releases it when its berries are in, when nothing is left to catch, or when the
feature is switched off. It asks for the berry with the largest shortfall.

**Shops shortcut.** `generateRegionShopsList` in
`additionalvisualsettings.user.js`, a direct analogue of the Gyms and Dungeons
shortcuts. Filters `town.content` with `instanceof Shop`, which catches the berry
master, gem master and trader variants that a `constructor.name` check would miss,
and opens each through `protectedOnclick()` so every variant reaches its own modal
rather than assuming `#shopModal`.

**Acceptance criteria.** FP mode and unlock mode cannot both be active. The café
stops cleanly when spins run out and releases any farm request. The shops modal
lists only reachable shops in the current region.

**Validation.** Build and the three suites pass, 68 checks. In-game validation
pending, and it matters more here than in phase 3: the `Shops` button position on
the town map (`left: 190`) is an estimate and may overlap `Dungeons`; the café needs
watching through a full day/dusk/night cycle to confirm it picks the right spins;
and the farm hand-off should be exercised with the quests focus running at the same
time.

---

## Phase 5 — Vitamins, helpers, Mystery Mine · done

**Auto Vitamins.** New module `automation/lib/Vitamins.js`, wired in the three places
a module needs. One per-Pokémon target per vitamin type, all 0 (off) by default —
starting to spend vitamins unasked would be painful to undo, since removing them is
one Pokémon at a time and entirely manual.

The distribution is what makes it balancing: candidates are sorted by how far they are
from the target and served in that order, so a short stock levels the party instead of
maxing out whichever Pokémon happens to come first in the party order. `useVitamin`
notifies on every refusal, so the disabled-vitamins challenge is checked once per loop
and Pokémon that are breeding or have hit the total cap are filtered out rather than
being allowed to generate a stream of warnings. The cap itself is
`(highestRegion + 1) * 5` **across all three types**, so three targets summing above
it simply leave the last one short — by design, not silently retried.

**Auto helpers.** Added to the Achievements focus, which is where it was asked for and
where it belongs: `HatcheryHelperRequirement` counts helpers that reached a given
bonus, and the only way to raise that bonus is to keep a helper hired while eggs hatch.
Off by default, with a 1-4 target that the game then caps at
`min(MAX_HIRES = 3, egg slots)`.

"Generation above consumption" is measured as the observed direction of the currency a
helper charges, sampled over a 30 second window rather than between two ticks — a
helper is paid on every hatch, so a single reading says nothing. Two consecutive
falling samples are required before letting anyone go. Helpers with the most hatches
are kept and hired first, since the achievement counts helpers that reached a bonus,
not hatches overall. Note that `hire()` does **not** charge — only `charge()` does, on
each hatch — so the hysteresis is there for notification spam, not for cost.

Helpers stay hired when the focus stops. The game fires them on its own when the
player can no longer pay, which is the same safety net a manual hire has.

Underground helpers are deliberately not covered: the request named hatchery helpers,
and the underground side is what the Mystery Mine option below is for.

**Mystery Mine.** `Mining-HuntMegaStones`, off by default, with Cynthia's sprite. It
stands in for the helper the game does not offer: helpers can only be assigned to the
five ordinary mines, and the Mystery Mine is the only one that yields mega stones,
since Chaos Cavern explicitly excludes them. A mega stone stops being an unlocked
underground item as soon as the player owns one, so "no mega stone left" is exactly an
empty filter result, and the player's own mine choice takes over again at that point.
`MineType.Special` was also added to the mine picker, which the game itself never
offers to search for directly.

**Validation.** Build and the three suites pass. Two test assertions were updated on
purpose: the mine picker now offers seven entries rather than six, and the module list
`init.test.mjs` mirrors gained `Vitamins`. In-game validation pending — in particular
that the vitamin distribution actually levels a party rather than front-loading it,
and that a helper is let go when its currency starts falling.

---

## Phase 6 — In-game time and weather · done

New `custom/simpletimechanger.user.js`, modelled on
`custom/simpleweatherchanger.user.js`: a `<select>`, a `localStorage`-backed choice, a
monkey-patch on the time source, and "PC Time" as the default.

The patch point is `GameHelper.tick`, which is the single place that refreshes
`GameHelper.currentTime`. Everything time-of-day reads that observable — the day cycle
indicator, time-locked evolutions, the Battle Café spin outcome — so overriding one
function covers all of them. Only the hour is forced; minutes and seconds keep
running. Code that calls `new Date()` directly is unaffected, which is why weather,
whose script passes its own `new Date()`, is still a separate control.

The relocation turned out not to need the mirroring path the plan expected. These
dropdowns are real elements with their own listeners, so `EpheniaControls` **moves**
them into a "Time and weather" section of its card, the same way it already moves
settings tables — no proxying, no `change` re-dispatch, and each script still works on
its own when the Automation bundle is absent. Inline styles neutralise the absolute
positioning those scripts pin onto the town map. The card is now built when either a
mirrored toggle **or** one of these dropdowns exists, so the time script alone is
enough to bring it up.

**Validation.** Five new checks in `bridges.test.mjs` cover the relocation. The
existing "a mirror section per script (5)" assertion was narrowed to count sections
that actually contain mirrors, since the card legitimately holds a sixth section now.
In-game validation pending: that forcing an hour actually flips the day cycle
indicator, and that the Battle Café then offers the matching spins.

---

## Phase 7 — Focus fallback order · done

The only change of the set that was a real rework.

**Problem.** A focus topic had no way to say "I am blocked". It called
`Menu.forceAutomationState(Focus.Settings.FeatureEnabled, false)` plus a warning
notification, and everything stopped. There was no priority chain, no queue, no
watchdog.

**What was built.**

`Automation.Focus.__reportBlocked(reason)` is the new outcome. It marks the running
topic blocked and hands over. Four of the five self-disable sites now use it:
Achievements out of achievements, Pokérus Cure out of locations, Shadow Purification
out of shadows, and the "cannot buy that pokéball" case — a topic that does not catch
anything can still make progress meanwhile.

`__ensureNoInstanceIsInProgress` deliberately still switches the feature off. Being
inside an instance blocks *every* topic, so cycling the chain would accomplish
nothing but noise. Turning the feature off also remains what happens when the whole
chain is blocked, which reproduces the old behaviour exactly.

`__internal__toggleFocus` was split into `__internal__startTopic` /
`__internal__stopActiveTopic`, so a switch always goes through the topic's own
`stop()`. That matters most for Quests, which seizes Click, Hatchery, Underground and
Farm on start and only releases them there; short-circuiting it would leave those
features force-enabled, greyed out, and with no owner. The running check also moved
from `__internal__focusLoop` to `__internal__activeFocus`, since topics that own their
loop leave the former null.

The chain is the chosen topic first, then up to three user-ordered fallbacks, stored
as one comma-separated `Focus-FallbackOrder`. Three dropdowns rather than a
drag-and-drop list: over twenty-odd topics that would have been far more UI than the
choice deserves. Duplicates are dropped on save, since a repeated topic would only
ever be tried once.

A block expires after 15 minutes and a supervisor re-evaluates every minute, which is
what brings the chosen topic back on its own. `__reportBlocked` is called from inside
a topic's own loop callback, so the switch is deferred through `setTimeout(0)` rather
than tearing that loop down underneath the code that asked for it.

**Validation.** Seven new checks in `init.test.mjs`: the three slots render and
default to None, and the selection itself is exercised directly — chain order,
skipping a locked fallback, an exhausted chain returning nothing, and an expired block
returning the chosen topic. Driving a real topic into a blocked state needs a working
game, so the test plants fake functionalities and calls
`__internal__findBestAvailableTopic`.

In-game validation pending: select Pokérus Cure with everything already cured, confirm
the handover and the notification, then confirm the return once a new candidate
appears. Also worth exercising a handover *out of* Quests, since it is the topic with
the most to release.
