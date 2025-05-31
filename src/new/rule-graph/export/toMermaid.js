
export function ruleGraphToMermaid(graph) {
    const lines = [`flowchart TD`]
    let n = 0
    const nextId = () => `N${++n}`;

    (function walk(node, parentId) {
        const id = nextId()
        lines.push(`    ${id}${shape(node)}`)
        if (parentId) lines.push(`    ${parentId} --> ${id}`);
        (node.children ?? []).forEach(c => walk(c, id))
    })(graph.root)

    return lines.join("\n")
}

function shape(node) {
    const lbl = `"${label(node)}"`
    const cls = node.constructor.name
    if (cls === "NodeDATAFIELD" || cls === "NodeRULE") return `[${lbl}]`
    return `(${lbl})`
}

function label(node) {
    const cls = node.constructor.name
    if (cls === "NodeRULE") {
        const t = node.type
            ?.replace(/^sh:/, "")
            .replace(/ConstraintComponent$/, "")
        return `${t}<br/>${format(node.value)}`
    }
    if (cls === "NodeDATAFIELD") {
        return `<b>${node.path}</b>`
    }
    if (cls === "NodeAND" || cls === "NodeOR" || cls === "NodeNOT") {
        return cls.replace("Node", "")
    }
    return cls
}

const format = v => Array.isArray(v) ? v.join(" | ") : v
