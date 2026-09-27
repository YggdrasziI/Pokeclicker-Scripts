// Publishes the Ephymew-only and Automation-only versions of the project from master.
//
//   node tools/variants/publish.mjs                  # generate, check, commit and push both branches
//   node tools/variants/publish.mjs --dry-run        # generate and check into a temp folder, no git
//   node tools/variants/publish.mjs --only=ephymew   # one version
//   node tools/variants/publish.mjs --no-realgame    # skip the real-game start of the Automation bundle
//
// master is the only branch anyone edits. Each other version is a generated distribution
// branch (see VARIANTS in markers.mjs): the files its players use, taken from master's HEAD,
// with the @variants passages filtered, the repository URLs pointed at the branch so script
// managers update from it, and a leak check that nothing names the other half of the project.
// Never commit to those branches by hand: the next publish overwrites them.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyVariantMarkers, VARIANTS } from './markers.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BUNDLE = 'pokeclickerautomation.user.js';

const options = { dryRun: false, only: null, realgame: true };
for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run') {
        options.dryRun = true;
    } else if (arg === '--no-realgame') {
        options.realgame = false;
    } else if (/^--only=(ephymew|automation)$/.test(arg)) {
        options.only = arg.slice('--only='.length);
    } else {
        throw new Error(`Unknown argument ${arg}`);
    }
}

// Files shipped by every version: the client, its update checker, the licence and the README
const COMMON = ['desktopupdatechecker.js', 'desktop/app.asar', 'desktop/README.md', 'LICENSE', 'README.md'];

const PLAN = {
    ephymew: {
        pick: (file) => (/^[^/]+\.user\.js$/.test(file) && file !== BUNDLE) || /^custom\/[^/]+\.user\.js$/.test(file),
        // Anything that names the Automation half (the lowercase word is ordinary English)
        forbidden: /Automation|pokeclickerautomation|[Ff]arigh/,
        allowed: [],
    },
    automation: {
        pick: (file) => file === 'automation/LICENSE.md',
        bundle: true,
        forbidden: /ephymew|ephenia/i,
        allowed: [
            // The script ABI every PokéClicker script shares; renaming it breaks them all (CLAUDE.md)
            'loadEpheniaScript', 'epheniaScriptInitializers',
            // Credit for ported code stays: automation/lib/ClickStats.js
            "Ported from Ephenia's Enhanced Auto Clicker",
        ],
    },
};

function git(args, opts = {}) {
    return execFileSync('git', args, { cwd: REPO_ROOT, maxBuffer: 256 * 1024 * 1024, ...opts });
}

function node(args, env = {}) {
    execFileSync(process.execPath, args, { cwd: REPO_ROOT, stdio: 'inherit', env: { ...process.env, ...env } });
}

const isText = (file) => !file.endsWith('.asar');

// --- Preconditions ------------------------------------------------------------------------

const head = git(['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const shortHead = head.slice(0, 7);
if (!options.dryRun) {
    if (git(['status', '--porcelain'], { encoding: 'utf8' }).trim()) {
        throw new Error('The working tree is not clean: commit master first, the versions are built from it');
    }
    if (git(['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim() !== 'master') {
        throw new Error('Publish from master');
    }
    git(['fetch', 'origin', 'master']);
    if (git(['rev-parse', 'origin/master'], { encoding: 'utf8' }).trim() !== head) {
        throw new Error('master is not origin/master: push master first');
    }
}

const work = mkdtempSync(path.join(tmpdir(), 'pokeclicker-variants-'));

// The committed full bundle must be the one its sources build
{
    const rebuilt = path.join(work, 'full.user.js');
    node(['automation/build.mjs', `--out=${rebuilt}`]);
    const normalize = (text) => text.replace(/\r\n/g, '\n');
    if (normalize(readFileSync(rebuilt, 'utf8')) !== normalize(git(['show', `HEAD:${BUNDLE}`], { encoding: 'utf8' }))) {
        throw new Error(`${BUNDLE} does not match its sources: run node automation/build.mjs and commit it`);
    }
}

const tracked = git(['ls-tree', '-r', '--name-only', 'HEAD'], { encoding: 'utf8' }).split('\n').filter(Boolean);

// --- Generation ---------------------------------------------------------------------------

/**
 * Writes the files of @p variant into @p dir, and returns their paths
 */
function generate(variant, dir) {
    const plan = PLAN[variant];
    const branch = VARIANTS[variant].branch;
    const files = new Map();
    for (const file of tracked.filter((f) => COMMON.includes(f) || plan.pick(f))) {
        files.set(file, git(['show', `HEAD:${file}`]));
    }
    if (plan.bundle) {
        const out = path.join(work, `${variant}.user.js`);
        node(['automation/build.mjs', `--variant=${variant}`, `--out=${out}`]);
        files.set(BUNDLE, readFileSync(out));
    }

    const exists = (target) => {
        const clean = target.replace(/\/$/, '');
        return files.has(clean) || [...files.keys()].some((f) => f.startsWith(`${clean}/`));
    };
    for (const [file, contents] of files) {
        if (!isText(file)) {
            continue;
        }
        let text = applyVariantMarkers(contents.toString('utf8'), variant, file);
        // Links to a file this version ships follow the branch; the rest (docs/, automation/ sources) stay on master
        text = text.replace(/(YggdrasziI\/Pokeclicker-Scripts\/(?:raw\/|blob\/|tree\/)?)master\/([^\s"'<>)#?]*)/g,
            (match, prefix, target) => (exists(target) ? `${prefix}${branch}/${target}` : match));
        files.set(file, Buffer.from(text, 'utf8'));
    }

    for (const [file, contents] of files) {
        mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
        writeFileSync(path.join(dir, file), contents);
    }
    return [...files.keys()];
}

/**
 * Lists every line of the generated text files that names the other half of the project
 */
function findLeaks(variant, dir, files) {
    const plan = PLAN[variant];
    const leaks = [];
    for (const file of files.filter(isText)) {
        readFileSync(path.join(dir, file), 'utf8').split('\n').forEach((line, index) => {
            const stripped = plan.allowed.reduce((text, allowed) => text.split(allowed).join(''), line);
            if (plan.forbidden.test(stripped)) {
                leaks.push(`${file}:${index + 1}: ${line.trim().slice(0, 160)}`);
            }
        });
    }
    return leaks;
}

function check(variant, dir, files) {
    const leaks = findLeaks(variant, dir, files);
    if (leaks.length) {
        throw new Error(`${variant}: ${leaks.length} line(s) name the other half of the project. `
            + `Wrap them in @variants markers on master (tools/variants/markers.mjs):\n${leaks.join('\n')}`);
    }
    if (PLAN[variant].bundle) {
        const bundle = path.join(dir, BUNDLE);
        for (const test of ['menu.test.mjs', 'init.test.mjs']) {
            execFileSync(process.execPath, [test], {
                cwd: path.join(REPO_ROOT, 'automation', 'test'), stdio: 'inherit',
                env: { ...process.env, AUTOMATION_BUNDLE: bundle },
            });
        }
        if (options.realgame) {
            node(['tools/realgame/start.mjs', bundle, '--scenario=tools/realgame/scenarios/automation-standalone.js']);
        }
    }
    console.log(`${variant}: ${files.length} files, no leak`);
}

// --- Publication --------------------------------------------------------------------------

function clearWorktree(dir) {
    for (const entry of readdirSync(dir)) {
        if (entry !== '.git') {
            rmSync(path.join(dir, entry), { recursive: true, force: true });
        }
    }
}

function publish(variant) {
    const branch = VARIANTS[variant].branch;
    const dir = path.join(work, branch);

    if (options.dryRun) {
        const files = generate(variant, dir);
        check(variant, dir, files);
        console.log(`${variant}: dry run, generated into ${dir}`);
        return;
    }

    let remoteExists = true;
    try {
        git(['fetch', 'origin', `${branch}:refs/remotes/origin/${branch}`], { stdio: 'ignore' });
    } catch {
        remoteExists = false;
    }
    if (remoteExists) {
        git(['worktree', 'add', '-B', branch, dir, `origin/${branch}`], { stdio: 'ignore' });
    } else {
        git(['worktree', 'add', '--detach', dir, 'HEAD'], { stdio: 'ignore' });
        execFileSync('git', ['checkout', '--orphan', branch], { cwd: dir, stdio: 'ignore' });
    }
    try {
        clearWorktree(dir);
        const files = generate(variant, dir);
        check(variant, dir, files);

        const inDir = (args, opts = {}) => execFileSync('git', args, { cwd: dir, ...opts });
        inDir(['add', '-A']);
        try {
            inDir(['diff', '--cached', '--quiet']);
            console.log(`${branch}: already up to date with master ${shortHead}`);
            return;
        } catch {
            // There is something to commit
        }
        inDir(['commit', '-q', '-m', `Sync from master ${shortHead}`, '-m', `Generated by tools/variants/publish.mjs from ${head}. Do not edit this branch: edit master and publish again.`]);
        inDir(['push', 'origin', branch], { stdio: 'inherit' });
        console.log(`${branch}: published ${inDir(['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()}`);
    } finally {
        git(['worktree', 'remove', '--force', dir], { stdio: 'ignore' });
    }
}

try {
    for (const variant of Object.keys(PLAN).filter((v) => !options.only || v === options.only)) {
        publish(variant);
    }
} finally {
    if (!options.dryRun) {
        rmSync(work, { recursive: true, force: true });
    }
}
