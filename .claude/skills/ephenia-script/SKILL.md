---
name: ephenia-script
description: Create or modify a standalone PokéClicker userscript at the repo root or under custom/ - its metadata header, its initialization, its entry in the in-game Scripts settings tab, or its registration with the desktop client. Use when asked to add a new .user.js script, change a script's settings UI, fix its update URL, or make an existing standalone script behave differently.
---

# ephenia-script

## Anatomy of a script

Root-level `*.user.js` are the general-purpose scripts; `custom/*.user.js` are the
cheat-adjacent or niche ones. Same structure either way:

1. **Metadata header**, lines 1-19, 13 tags in a fixed order.
2. **The implementation** — either a `function initXxx()` or a class with static
   methods (`AdditionalVisualSettings` is the class-style reference).
3. **`initLocalStorage(key, default)` calls** for persisted settings.
4. **A copy of `loadEpheniaScript`** — every script carries its own; the first one
   to load installs the shared initializer table, the rest detect it.
5. **The registration call** at the very bottom.

## The header

```
// ==UserScript==
// @name          [Pokeclicker] <Title>
// @namespace     Pokeclicker Scripts
// @author        <original author(s)>
// @description   <one paragraph, no line breaks>
// @copyright     https://github.com/YggdrasziI
// @license       GPL-3.0 License
// @version       <x.y.z>

// @homepageURL   https://github.com/YggdrasziI/Pokeclicker-Scripts/
// @supportURL    https://github.com/YggdrasziI/Pokeclicker-Scripts/issues
// @downloadURL   https://raw.githubusercontent.com/YggdrasziI/Pokeclicker-Scripts/master/<path>
// @updateURL     https://raw.githubusercontent.com/YggdrasziI/Pokeclicker-Scripts/master/<path>

// @match         https://www.pokeclicker.com/
// @icon          https://www.google.com/s2/favicons?domain=pokeclicker.com
// @grant         unsafeWindow
// @run-at        document-idle
// ==/UserScript==//
```

`custom/` scripts use `.../master/custom/<file>.user.js` in the two raw URLs.

`@author` credits whoever wrote it — Ephenia, Optimatum, Farigh, and others.
That line is attribution and does not change. `@downloadURL` / `@updateURL` are
what Tampermonkey fetches: pointing them at another account silently replaces the
local script with that account's copy on the next update check.

Bump `@version` on any behaviour change. The desktop client compares checksums,
not versions, but Tampermonkey users see this.

## Registration

```js
if (!App.isUsingClient || localStorage.getItem('<scriptname>') === 'true') {
    loadEpheniaScript('<scriptname>', initXxx, priorityFunctionIfNeeded);
}
```

`<scriptname>` is the file's basename without `.user.js`, lowercase, and it is the
key the desktop client uses to enable/disable the script. It must match the
filename exactly.

The third argument runs on `$(document).ready()`, **before** the game applies its
Knockout bindings. Use it only for DOM the game will later bind to —
`additionalvisualsettings.user.js` needs it to inject the vitamin ⚖ button into a
`data-bind` template.

## The settings tab

`createScriptSettingsContainer(name)` builds (once) a "Scripts" tab in the game's
settings modal, then returns a `<tbody>` for your script's own table. The
canonical definition is `additionalvisualsettings.user.js:454-499`; each script
ships a copy.

Two traps:

- **The id strips every letter `s`.** `"Additional Visual Settings"` becomes
  `settings-scripts-additionalvisualetting`. Not a typo — `automation/test/bridges.test.mjs:25`
  depends on it. Do not "fix" it; other scripts and the Automation card's
  relocation logic key off these ids.
- Tables are inserted **in alphabetical order of that id**, not in load order.

Rows are `<tr>` with a `<th class="p-2 col-md-5" scope="row">` label and a `<td>`
holding the control. `automation/lib/EpheniaControls.js:129-154` later moves these
tables into the Automation "Ephenia scripts" card, so keep the `<thead>` present —
it is what supplies the category title there.

## Never rename the ABI

`loadEpheniaScript`, `window.epheniaScriptInitializers`, `createScriptSettingsContainer`
and the `ephenia-*` DOM ids are the contract with every Ephenia script published
outside this repository, including ones the user may have installed from
elsewhere. Renaming any of them breaks cross-script compatibility and the
Automation bridges. Account names inside *URLs* are ours to change; these are not.

## Interoperating with the Automation bundle

- A script whose main switch should appear in the Automation "Ephenia scripts"
  card needs its button id listed in `automation/lib/EpheniaControls.js:25-56`.
  That mirror only understands on/off buttons carrying `btn-success` /
  `btn-danger`; a `<select>` needs a different path.
- A script that drives the same activity as an Automation feature needs a conflict
  entry in `automation/lib/Bridges.js:42-50`, or the two will fight.

## Safety rules

- Never guess a PokéClicker API — see `CLAUDE.md`. These scripts run against the
  live game with no tests at all.
- Monkey-patching a game function (`Weather.generateWeather`,
  `PartyPokemon.prototype.*`) is an accepted pattern here, but keep and call the
  original, and patch once — guard against double initialization.
- Do not add a script to `README.md` without also adding its section links in the
  same style as the others.
- Do not copy a modified `loadEpheniaScript` into a new script. Copy it verbatim
  from an existing one.

## Validation

There is no test harness for standalone scripts. The gate is manual:

- Syntax check what you can: `node --check <file>.user.js`.
- Confirm the registration name matches the filename.
- Confirm the two raw URLs contain the correct path, including `custom/`.
- Then say plainly that in-game verification is pending, and name the checks:
  the script loads without the `loadEpheniaScript` crash notification, its
  settings row appears under the Scripts tab, and its setting survives a reload.
