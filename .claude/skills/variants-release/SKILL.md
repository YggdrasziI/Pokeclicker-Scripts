---
name: variants-release
description: Keep the three versions of the project in step - Complete (master), Ephymew only and Automation only - and publish the two generated branches after a change. Use after any change pushed to master, when a text or script mentions the other half of the project, when the publish leak check fails, when adding a script or an Automation module that cooperates with the other half, or when asked about the versions, the version setting of the desktop client, or the ephymew-only / automation-only branches.
---

# variants-release

## The three versions

| Version | Branch | What it ships |
| --- | --- | --- |
| Complete | `master` | Everything: the standalone scripts, `custom/`, the Automation bundle |
| Ephymew only | `ephymew-only` | The standalone scripts and `custom/`, no Automation |
| Automation only | `automation-only` | `pokeclickerautomation.user.js` built without `Bridges` and `EpheniaControls` |

Every version also ships `README.md` (filtered), `desktop/app.asar`,
`desktop/README.md`, `desktopupdatechecker.js` and `LICENSE`. The two variant
branches are **distribution only**: no `automation/` sources, no tools, no docs, no
skills.

Players pick a version two ways:
- **Desktop client:** Settings → Scripts → *Scripts version*
  (`DesktopScriptHandler.getScriptsBranch()` in `desktop/app_src/src/scripthandler.js`).
  `main.js` lists the scripts with `?ref=<branch>`. Files of the other version are
  renamed `.disabled` on the next launch.
- **Browser script manager:** the One-Click Install links of a branch's README. The
  publish points every `@updateURL` at the branch the file ships from.

## The one rule: edit master only

`ephymew-only` and `automation-only` are **generated** by `tools/variants/publish.mjs`
from master's HEAD. Never commit, cherry-pick or fix anything on them: the next
publish overwrites them. Every change, whatever version it concerns, is made on
master and then published.

## Variant markers

A passage that belongs only in some versions is wrapped in marker lines, in the
comment syntax of the file (`tools/variants/markers.mjs`):

```
// @variants full automation          <!-- @variants full ephymew -->
...                                    ...
// @end-variants                       <!-- @end-variants -->
```

- The names are `full`, `ephymew` and `automation`. Always list `full` unless the
  passage is replaced in master by another block.
- A replacement for a version is a second block right after the first:
  `@variants full` holds master's text, then `@variants ephymew` holds the rewrite.
- Blocks cannot nest. Split the outer block around the inner passage instead.
- Marker lines are dropped from every generated file, including the full Automation
  bundle. `node automation/build.mjs` must still produce a byte-identical bundle
  after adding markers to `automation/`.
- **Markdown:** a marker line interrupts a list or a paragraph. Inside a list, or a
  run of `•` lines, duplicate the **whole** list per version, never one item.
  Inside a ```` ``` ```` block, the markers go outside the fence and duplicate the
  block. Otherwise master's rendering changes.
- **A new script, or a new README section:** its README section and its index entry
  go inside the matching `full ephymew` or `full automation` blocks. The index is
  duplicated per version, so add the entry to each copy that lists it.

## What must be marked

Anything a player of one version would read that names the other half:

- **In the Ephymew-only version:** `Automation` (capitalised),
  `pokeclickerautomation` and Farigh. The lowercase word "automation" is ordinary
  English and allowed.
- **In the Automation-only version:** ephymew and Ephenia, in any case. Allowed
  exceptions:
  - the ABI identifiers `loadEpheniaScript` and `epheniaScriptInitializers`, which
    are never renamed (CLAUDE.md);
  - the credit line of `automation/lib/ClickStats.js`, since credit for ported code
    stays.

  They are listed in `PLAN.automation.allowed` in `publish.mjs`. Add to that list
  only for the same reasons, never to silence a real mention.
- **In `automation/`:** a new module that only cooperates with the standalone
  scripts, like `Bridges` and `EpheniaControls`, goes in `FULL_ONLY` in
  `automation/build.mjs`, and its alias and `initialize` call in `Automation.js`
  go inside `// @variants full`.
- **In a standalone script:** a comment naming the Automation script gets a
  `@variants full` block and a neutral `@variants ephymew` rewrite. See
  `custom/infinitebattlecafe.user.js`.

## Publishing

After master is committed **and pushed**:

```bash
node tools/variants/publish.mjs              # both branches
node tools/variants/publish.mjs --dry-run    # generate + check into a temp folder, prints it
```

For each version, it:
1. rebuilds the full bundle and refuses to publish if the committed one differs;
2. copies the version's files from HEAD, filters the markers, and points the
   repository links at the branch. Links to files the branch does not ship, such as
   `docs/ROADMAP.md`, stay on master;
3. runs the **leak check**, then for Automation only runs `menu`/`init` on the
   variant bundle and `tools/realgame/start.mjs` with
   `scenarios/automation-standalone.js`. `--no-realgame` skips the latter when no
   game build is installed; say so in the report;
4. commits `Sync from master <hash>` on the branch, when something changed, and
   pushes it.

It refuses to run on a dirty tree, off master, or when master is ahead of
`origin/master`.

## When the check fails

The error lists `file:line` for every leak. Fix it **on master**, with markers or a
rewording. Then commit and push master, and publish again. Never weaken
`forbidden`, and never edit the generated branch.

## Delivering

A change is delivered when master is pushed **and** `publish.mjs` has run. Report
master's hash and the two branch lines the script prints (`published <hash>` or
`already up to date`).
