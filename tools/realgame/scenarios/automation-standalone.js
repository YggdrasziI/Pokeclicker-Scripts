// Scenario for tools/realgame/start.mjs, with the automation-only version of the bundle
// (tools/variants/publish.mjs builds it and runs this): the bundle must start on its own and
// carry none of the modules that only cooperate with the other scripts.
try {
    const out = [];
    const check = (label, condition, detail) => {
        out.push(`${condition ? 'ok  ' : 'FAIL'} ${label}${detail !== undefined ? ` -- ${detail}` : ''}`);
        if (!condition) {
            window.__scenarioFailed = true;
        }
    };

    check('Automation started', typeof Automation === 'function' && Automation.Menu !== undefined);
    check('focus drop-down built', document.getElementById('Roamers') !== null);
    check('no conflict bridge', Automation.Bridges === undefined && typeof AutomationBridges === 'undefined');
    check('no mirrored controls', Automation.EpheniaControls === undefined && typeof AutomationEpheniaControls === 'undefined');
    check('no mirrored controls card', document.querySelector('[id^="epheniaControls-"]') === null);

    console.log(out.join('\n'));
    window.__scenario = !window.__scenarioFailed;
} catch (error) {
    console.log(`SCENARIO FAILED: ${error.stack || error}`);
    window.__scenario = false;
}
