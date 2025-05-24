
export function ruleGraphToMermaid(graph) {
    const lines = [`flowchart TD`]
    const idGen = (() => {
        let n = 0
        return () => "N" + (++n)
    })();

    (function walk(node, parentId) {
        const id = idGen()
        lines.push(`    ${id}${shape(node)}`)
        if (parentId) lines.push(`    ${parentId} --> ${id}`);
        (node.children || []).forEach(child => walk(child, id))
    })(graph.root)

    return lines.join("\n")
}

function shape(node) {
    let str = `"${label(node)}"`
    if (node.type === "RULE") return `[${str}]`
    return `([${str}])`
}

function label(node) {
    if (node.type !== "RULE") return node.type
    const { path, in: _in, notIn: _notIn, minInclusive, minExclusive, maxInclusive, maxExclusive } = node.rule
    const parts = [
        `<b>${path}</b>`,
        _in !== undefined ? `= ${format(_in)}` : null,
        _notIn !== undefined ? `!= ${format(_notIn)}` : null,
        minInclusive != null ? `<= ${minInclusive}` : null,
        minExclusive != null ? `< ${minExclusive}` : null,
        maxInclusive != null ? `>= ${maxInclusive}` : null,
        maxExclusive != null ? `> ${maxExclusive}` : null,
    ].filter(Boolean)
    return `${parts.join("<br/>")}`
}

const format = v => Array.isArray(v) ? v.join(" | ") : v
