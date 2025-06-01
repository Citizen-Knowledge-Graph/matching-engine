
export function ruleGraphToMermaid(graph, styled) {
    const lines  = [`flowchart TD`]
    const styles = styled ? [
            "classDef ok        fill:#2ecc71,stroke:#0e8046,stroke-width:2px",
            "classDef violation fill:#ff4136,stroke:#ad0e05,stroke-width:2px",
            "classDef missing   fill:#d9d9d9,stroke:#6e6e6e,stroke-width:2px"
        ] : []
    let seq = 0
    const nextId = () => `N${++ seq}`;

    (function walk(node, parentId) {
        const id = nextId()
        lines.push(`    ${id}${shape(node)}`)
        if (parentId) lines.push(`    ${parentId} --> ${id}`)
        if (styled) styles.push(`class ${id} ${nodeStatus(node)}`);
        (node.children ?? []).forEach(c => walk(c, id))
    })(graph.root)

    return styled ? [... lines, ... styles].join("\n") : lines.join("\n")
}

function nodeStatus(node) {
    if (node.constructor.name === "NodeRULE") return node.shaclEval?.status ?? "missing"
    return node.status ?? "ok"
}

function shape(node) {
    const txt  = `"${label(node)}"`
    const type = node.constructor.name
    return (type === "NodeDATAFIELD" || type === "NodeRULE") ? `[${txt}]` : `(${txt})`
}

function label(node) {
    const cls = node.constructor.name
    if (cls === "NodeRULE") {
        const short = node.type.replace(/^sh:/, "").replace(/ConstraintComponent$/, "")
        const base  = `${short}<br/>${format(node.value)}`

        const st = node.shaclEval?.status
        if (st === "violation" && node.shaclEval.actualValue !== undefined) {
            return `${base}<br/><span style="font-size:0.8em;color:#555">(actual: ${pretty(node.shaclEval.actualValue)})</span>`
        }
        if (st === "missing") {
            return `${base}<br/><span style="font-size:0.8em;color:#555">(missing)</span>`
        }
        return base
    }
    if (cls === "NodeDATAFIELD") return `<b>${escape(node.path)}</b>`
    if (cls === "NodeAND" || cls === "NodeOR" || cls === "NodeNOT" || cls === "NodeROOT")
        return cls.slice(4) || "ROOT"
    return cls
}

const format = v => Array.isArray(v) ? v.map(pretty).join(" | ") : pretty(v)
const pretty = s => escape(String(s).replace("https://foerderfunke.org/default#", "ff:"))
const escape = s => s.replace(/"/g, "&quot;")
