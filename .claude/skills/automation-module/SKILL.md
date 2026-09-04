---
name: automation-module
description: Add or modify a module in the PokéClicker Automation library under automation/lib - a new automated feature, a new setting, a toggle, a dropdown, a number field, a tooltip, or a floating panel bound to an in-game modal. Use when asked to add an option to the Automation menu, automate a game mechanic, or change how an existing Automation feature behaves.
---

# automation-module

## Where things live

| Concern | File |
| --- | --- |
| Entry point, aliases, init order | `automation/Automation.js` |
| Bundle order, userscript header | `automation/build.mjs` |
| All UI helpers | `automation/lib/Menu.js` |
| Setting persistence | `automation/lib/Utils/LocalStorage.js` |
| Per-module notification opt-outs | `automation/lib/Notifications.js` |
| Game-mechanic helpers | `automation/lib/Utils/` (`Battle`, `Gym`, `OakItem`, `Pokeball`, `Route`) |
| Modal-bound features | `automation/lib/Instances/` |

`pokeclickerautomation.user.js` at the repo root is **generated**. Never edit it.

## Wiring a new module

Three edits, all mandatory. Missing one fails quietly.

1. `automation/build.mjs` — add the path to `SOURCES`. The list is a hand-kept
   **dependency order**: a class must appear before any class whose *static field
   initializers* name it. That is why `lib/Focus/*.js` come before `lib/Focus.js`.
2. `automation/Automation.js` — add `static Xxx = AutomationXxx;` to the alias
   block, and `this.Xxx.initialize(initStep);` to the init loop.
3. `automation/lib/Notifications.js` — add a key if the module sends notifications,
   so the user can mute it.

## Adding a setting

The id is the storage key is the DOM id. One string, declared once:

```js
static Settings = { MyOption: "MyModule-MyOption" };
```

Then pick the right helper from `Menu.js`:

| Need | Helper |
| --- | --- |
| Main On/Off switch for the feature | `addAutomationButton(label, id, tooltip, containingDiv, forceDisabled)` |
| Advanced-settings disclosure under a switch | `addSettingPanel(button.parentElement.parentElement)` |
| Toggle inside that panel | `addLabeledAdvancedSettingsToggleButton(label, id, tooltip, panel)` |
| Bare toggle (you place the label) | `addLocalStorageBoundToggleButton(id)` |
| Dropdown | `createDropDownListElement(id)` (plain) or `createDropdownListWithHtmlOptions(options, label, tooltip)` |
| Number / text field | `createTextInputElement(charLimit, acceptedRegex)` |
| Grouping | `createSettingCategory(title)`, `createTitleElement(text)`, `addTabElement(parent, label, group)`, `addSeparator(div)` |
| Panel inside an in-game modal | `addFloatingCategory(categoryId, title, ingameModal)` |
| Save-confirmation animation | `createAnimatedCheckMarkElement()` + `showCheckmark(container)` |

Read the value back with
`Automation.Utils.LocalStorage.getValue(this.Settings.MyOption) === "true"`.
Everything is stored as a **string**.

There is no number-input helper. `createTextInputElement` returns a
`contentEditable` div, so you bind it yourself. Copy
`__internal__addNumberSetting` in `automation/lib/SaveBackup.js`:

```js
const input = Automation.Menu.createTextInputElement(charLimit, "[0-9]");
input.id = setting;
input.textContent = Automation.Utils.LocalStorage.getValue(setting);
input.oninput = () => Automation.Utils.LocalStorage.setValue(setting, input.textContent.trim());
```

`createDropdownListWithHtmlOptions` returns a container, not a `<select>`. Persist
through `container.onValueChange` and read `container.selectedValue` — see
`addPokeballList` in `Menu.js` for the reference use.

## Tooltips

No `title` attributes, no JS hover handlers. Two lines:

```js
elem.classList.add("hasAutomationTooltip");
elem.setAttribute("automation-tooltip-text", text);
```

`addAutomationButton`, `addLabeledAdvancedSettingsToggleButton` and
`createDropdownListWithHtmlOptions` do it for you when `tooltip !== ""`. The CSS
renders `white-space: pre`, so `\n` gives real line breaks; separate paragraphs
with `Automation.Menu.TooltipSeparator`. Default reveal delay is 2 s — add
`shortTransitionAutomationTooltip` for 0.5 s. Positioning modifiers exist per
context (`centeredAutomationTooltip`, `rightMostAutomationTooltip`,
`warningAutomationTooltip`, …); reuse the one already used nearby.

## Feature interlocks

When a feature takes over another one, disable rather than fight it:

```js
Automation.Menu.setButtonDisabledState(otherId, true, "reason shown to the user");
Automation.Menu.forceAutomationState(otherId, true);
```

and undo both in your `stop()`. `__internal__start` / `__internal__stop` in `automation/lib/Focus/Quests.js`
is the reference: it seizes Click, Hatchery, Underground and Farm on start and releases
every one of them on stop.

Cross-script conflicts with the Ephenia userscripts are declared in
`automation/lib/Bridges.js` — add an entry there if the new feature drives the
player's position or an activity an Ephenia script also drives.

## Safety rules

- Never edit `pokeclickerautomation.user.js`. Edit the module and rebuild.
- Never guess a PokéClicker API. `automation/test/gamestub.mjs` answers every
  property access with a permissive stub, so a wrong signature passes the tests
  and fails only in the browser. Check the game source — see `CLAUDE.md`.
- New features and settings default to **off**. `init.test.mjs` asserts it.
- Do not use the in-game hatchery queue or any mechanic the module deliberately
  avoids without saying why — those choices are documented in the tooltips
  (the auto-hatchery tooltip in `Hatchery.js` explains why the queue is not used).
- Keep the module's own state in `__internal__` statics. Cross-module state goes
  through a documented public field (`Automation.Farm.ForcePlantBerriesAsked` is
  the only one today) — and if you add a second writer to one, decide who wins.
- Do not add a setting the task did not ask for.

## Validation

```bash
node automation/build.mjs
cd automation/test && npm test
```

- `menu.test.mjs` — the card docks in `#right-column`, categories are collapsible,
  floating categories stay out of the card.
- `init.test.mjs` — every module in its `MODULES` list initializes without throwing, every feature
  toggle defaults to Off, advanced-settings disclosures are in-flow siblings.
- `bridges.test.mjs` — the Ephenia conflict matrix targets real buttons.

Then say explicitly that in-game verification is still pending: the option should
appear in the right category, start Off, survive a reload, and show its tooltip.
