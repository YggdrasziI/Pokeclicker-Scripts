// Variant markers: the one mechanism that keeps a passage out of a version of the project.
//
// master holds every file of every version. A passage that only belongs in some of them is
// wrapped in two comment lines, in whatever comment syntax the file uses:
//
//   // @variants full automation            <!-- @variants full ephymew -->
//   ...                                     ...
//   // @end-variants                        <!-- @end-variants -->
//
// The passage is kept only in the listed versions. The marker lines themselves are dropped
// from every output, including full, so a generated file carries no trace of them.

export const VARIANTS = {
    // The branch each version is published on, and what the desktop client asks for
    full: { branch: 'master' },
    ephymew: { branch: 'ephymew-only' },
    automation: { branch: 'automation-only' },
};

const BEGIN = /@variants\s+([a-z ]+?)\s*(?:-->|\*\/)?\s*$/;
const END = /@end-variants\b/;

/**
 * Keeps the passages of @p text that belong in @p variant, and drops every marker line
 */
export function applyVariantMarkers(text, variant, name = '<text>') {
    if (!(variant in VARIANTS)) {
        throw new Error(`Unknown variant '${variant}'`);
    }

    const lines = text.split('\n');
    const output = [];
    let block = null;
    lines.forEach((line, index) => {
        const begin = BEGIN.exec(line);
        if (begin) {
            if (block) {
                throw new Error(`${name}:${index + 1}: @variants inside another @variants block (opened line ${block.line})`);
            }
            const listed = begin[1].trim().split(/\s+/);
            const unknown = listed.filter((v) => !(v in VARIANTS));
            if (unknown.length) {
                throw new Error(`${name}:${index + 1}: unknown variant(s) ${unknown.join(', ')}`);
            }
            block = { line: index + 1, keep: listed.includes(variant) };
            return;
        }
        if (END.test(line)) {
            if (!block) {
                throw new Error(`${name}:${index + 1}: @end-variants without @variants`);
            }
            block = null;
            return;
        }
        if (!block || block.keep) {
            output.push(line);
        }
    });
    if (block) {
        throw new Error(`${name}:${block.line}: @variants block never closed`);
    }
    return output.join('\n');
}
