---
name: automation-focus
description: Add or modify a topic in the Automation "Focus on" system - a new entry in the focus dropdown, its advanced-settings tab, its loop, or how it reacts when it cannot make progress. Use when asked to change what a focus farms, add a focus, change focus priorities or ordering, or handle a focus that gets stuck or turns itself off.
---

# automation-focus

## The model

A focus topic is a **plain object literal** pushed into
`AutomationFocus.__internal__functionalities`:

```js
{
    id: "DungeonTokens",          // unique; the <option> value and the persisted setting
    name: "Dungeon Tokens",       // <option> text
    tooltip: "...",               // paragraphs separated by Automation.Menu.TooltipSeparator
    run: function() {...}.bind(this),
    stop: function() {...},       // optional
    isUnlocked: function() {...}, // optional; absent means always visible
    refreshRateAsMs: 3000         // or Automation.Focus.__noFunctionalityRefresh (-1)
}
```

Only one topic runs at a time. `__internal__activeFocus` is what is running;
`__internal__wantedTopicId` is what the player picked in the dropdown. They differ
while a fallback is covering for a blocked topic — see below.

**The single insertion point is `Focus.js:426-478`**
(`__internal__buildFunctionalitiesList`). Simple topics are pushed inline there;
complex ones live in `automation/lib/Focus/<Topic>.js` and are pulled in by
`this.<Topic>.__registerFunctionalities(this.__internal__functionalities)`.
**The order of that function is the order of the dropdown.**
`__internal__addFunctionalitySeparator(title, isUnlocked)` inserts a disabled
heading option.

## Two loop styles

- **Shared loop** — set a real `refreshRateAsMs`; `Focus.js:394` owns the
  `setInterval` and calls `run()` immediately once. Used by XP, Gold, Dungeon
  Tokens and every Gems topic.
- **Private loop** — set `refreshRateAsMs: Automation.Focus.__noFunctionalityRefresh`
  and own a `setInterval` inside `__internal__start()` / `__internal__stop()`.
  Used by Quests (1 s), Achievements (1 s), PokerusCure (10 s),
  ShadowPurification (10 s). Pick this when the topic must set up and tear down
  other features.

## Adding a topic in its own file

1. `automation/lib/Focus/<Topic>.js`, one class `AutomationFocus<Topic>`.
   `ShadowPurification.js` (305 lines, no settings) is the smallest complete
   example; `PokerusCure.js` is the one to copy when the topic needs precomputed
   route/dungeon data and advanced settings.
2. `automation/build.mjs` — add it to `SOURCES` **before `lib/Focus.js`**.
   `Focus.js` has static field initializers naming these classes, so a later
   position is a load-time crash.
3. `Focus.js:7-10` — `static <Topic> = AutomationFocus<Topic>;`
4. `Focus.js:472-475` — call `__registerFunctionalities`.
5. Optional settings tab in `Focus.js:290-343`, via
   `Automation.Menu.addTabElement(panel, "<Label>", "automationFocusSettings")`
   then `this.<Topic>.__buildAdvancedSettings(container)`.

Setting keys are `Focus-<Topic>-<Setting>` (`PokerusCure.js:73-76` is the
reference). Per-item toggles generated from game data use a key factory —
`Achievements.js:13` and `Quests.js:61` do it differently (`Focus-Achievements-…`
vs `Focus-…`); follow whichever file you are in, do not "harmonise" them.

## Shared helpers — use these, do not reimplement

From `Focus.js`, the "Focus specific members" block:

| Helper | Purpose |
| --- | --- |
| `__ensureNoInstanceIsInProgress()` | Asks Dungeon to stop; returns false while inside an instance. Call it first in `run()`. |
| `__goToBestRouteForDungeonToken()` | Token-farming detour. |
| `__goToBestGymOrRouteForGem(gemType)` | Compares `Utils.Gym.findBestGymForFarmingType` and `Utils.Route.findBestRouteForFarmingType` at 1/1000 precision. |
| `__enableAutoGymFight(gymName)` | Selects the gym and force-enables `Automation.Gym`. |
| `__ensurePlayerHasEnoughBalls(ballType)` | Buys balls, or diverts to money farming. |
| `__equipLoadout(candidates)` | No-op unless the Oak-item-loadout setting is on. |

`Automation.Dungeon.setBeforeNewRunCallBack(fn)` is the documented hook to act
between dungeon runs (`ShadowPurification.js:179`).

## When a topic cannot progress

A topic has four exits. Know which one you are looking at before changing
behaviour:

1. **Hand over** — `Automation.Focus.__reportBlocked("why")`. This is what a topic
   that has run out of work should do. The topic is marked blocked, the feature
   moves to the next entry of the user's fallback chain, and the topic gets its
   turn back once the block expires (`__internal__blockedTopicRetryDelayMs`, 15
   minutes) or the feature is restarted. Call sites: `Focus.js`
   (`__ensurePlayerHasEnoughBalls`), `Achievements.js`, `PokerusCure.js`,
   `ShadowPurification.js`.
2. **Kill the whole feature** — still correct for a condition no other topic could
   survive either. `__ensureNoInstanceIsInProgress` is the one remaining case:
   being inside an instance blocks every topic, so cycling the chain would
   accomplish nothing. `__internal__switchToBestAvailableTopic` also ends here
   when the entire chain is blocked, which reproduces the old behaviour.
3. **Silent early `return`** from `run()` — the guard helpers above.
4. **Self-diversion** — farm money or tokens, then come back
   (`Quests.js:481-494`).

`__reportBlocked` is called from inside a topic's own loop callback, so the switch
is deferred through a `setTimeout(0)` rather than tearing the loop down underneath
the code that asked for it. Keep that if you touch it.

`Quests.js` still never reports itself blocked: `__internal__workOnQuest` has no
timeout, and the `CatchShadowsQuest` branch is hard-coded to
`"Phenac City Battles"` (`Quests.js:423`) and spins forever if that dungeon is
unreachable. Its stuck watchdog refreshes the quest list rather than handing over.

## Safety rules

- `__internal__sortQuestByPriority` (`Quests.js:892-957`) is **not a valid total
  order** — it ignores `b` once `a` matches. That is tolerated because only `[0]`
  is used. Do not feed it to anything that needs a real comparator, and do not
  "fix" it without checking every caller.
- `Quests.__internal__start` seizes Click, Hatchery, Underground and Farm and
  releases them in `__internal__stop`. Any automatic topic switch must go through
  `stop()`; short-circuiting it leaves the game in a half-driven state.
- `Achievements.__internal__getAchievementsData()` doubles as the initializer of
  the filtered achievement list and is called from the menu-building path. Moving
  it breaks selection.
- Never guess a PokéClicker API — see `CLAUDE.md`.
- New settings default to off.

## Validation

```bash
node automation/build.mjs
cd automation/test && npm test
```

`init.test.mjs` covers initialization and, at the end, the fallback selection
itself — chain order, skipping locked topics, an exhausted chain, and a block
expiring. It does that by planting fake functionalities and calling
`__internal__findBestAvailableTopic` directly, since driving a real topic into a
blocked state needs a working game behind it. Extend that block rather than
inventing a new harness.

Nothing else about focus behaviour is covered, so state the in-game checks as
pending and name them: the topic appears in the dropdown at the right position, is
hidden until `isUnlocked()` passes (a 5 s watcher reveals it), selecting it forces
the feature off, and the setting survives a reload. For the blocked path, exercise
a topic that genuinely runs out of work — Pokérus Cure once everything is cured.
