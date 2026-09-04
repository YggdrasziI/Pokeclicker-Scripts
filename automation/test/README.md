# Automation tests

`menu.test.mjs` drives the `Menu` host layer against a jsdom DOM that mimics the
parts of Pokeclicker's markup the adapter attaches to (the Start Menu dropdown,
and an in-game modal for floating categories). It checks that the Automation
modal is built with the game's own Bootstrap classes, that categories register as
tabs, that floating categories stay inline on their in-game modal, and that
features default to Off.

Run it after `node automation/build.mjs`, since it loads the built bundle:

```sh
npm install jsdom          # one-off, not committed
node automation/test/menu.test.mjs
```
