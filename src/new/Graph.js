export class Graph {
    constructor(jsonLd) {
        let implicitAndNode = new Node("AND", jsonLd["sh:property"].map(walk))
        this.root = new Node("ROOT", [implicitAndNode])
    }
}

export class Node {
    constructor(type, children, rule) {
        this.type = type
        if (children.length > 0) this.children = children
        if (rule) this.rule = rule
    }
}

function walk(obj) {
    const children = []

    if (obj["sh:property"]) {
        const props = obj["sh:property"]
        const list  = Array.isArray(props) ? props : [props]
        children.push(... list.map(walk))
    }

    if (obj["sh:not"]) children.push(new Node("NOT", [walk(obj["sh:not"])]))
    if (obj["sh:or"]) children.push(new Node("OR", list(obj["sh:or"]).map(walk)))
    if (obj["sh:and"]) children.push(new Node("AND", list(obj["sh:and"]).map(walk)))

    if (children.length === 1) return children[0]
    if (children.length >  1) return new Node("AND", children) // implicit AND

    if (obj["sh:path"]) return makeRule(obj)

    throw new Error("Unhandled shape fragment:\n" + JSON.stringify(obj, null, 2))
}

function makeRule(p) {
    const rule = Object.fromEntries(
        [
            ["path", p["sh:path"]?.["@id"]],
            ["minInclusive", num(p["sh:minInclusive"])],
            ["minExclusive", num(p["sh:minExclusive"])],
            ["maxInclusive", num(p["sh:maxInclusive"])],
            ["maxExclusive", num(p["sh:maxExclusive"])],
            ["in", p["sh:in"] ? list(p["sh:in"]).map(atom) : null]
        ].filter(([, v]) => v !== null)
    )
    return new Node("RULE", [], rule)
}

const list = x => x?.["@list"] ?? []
const num  = lit => lit ? Number(lit["@value"]) : null

function atom(lit) {
    if (lit["@id"]) return lit["@id"]
    const { ["@type"]: t, ["@value"]: v } = lit
    return t?.endsWith("boolean")  ? v === "true" : t?.endsWith("integer") ? Number(v) : v
}

export function toMermaid(graph, dir = "TD") {
    const lines = [`flowchart ${dir}`]
    const idGen = (() => {
        let n = 0
        return () => "N" + (++n)
    })();

    (function walk(node, parentId) {
        const id = idGen()
        lines.push(`    ${id}${shape(node)}`)
        if (parentId) lines.push(`    ${parentId} --> ${id}`);
        (node.children || []).forEach(child => walk(child, id))
    })(graph.root ?? graph)

    return lines.join("\n")
}

function shape(node) {
    let str = `"${label(node)}"`
    if (node.type === "RULE") return `[${str}]`
    return `([${str}])`
}

function label(node) {
    if (node.type !== "RULE") return node.type
    const { path, in: _in, minInclusive, minExclusive, maxInclusive, maxExclusive } = node.rule
    const parts = [
        `<b>${path}</b>`,
        _in !== undefined ? `= ${format(_in)}`      : null,
        minInclusive != null ? `<= ${minInclusive}` : null,
        minExclusive != null ? `< ${minExclusive}` : null,
        maxInclusive != null ? `>= ${maxInclusive}` : null,
        maxExclusive != null ? `> ${maxExclusive}` : null,
    ].filter(Boolean)
    return `${parts.join("<br/>")}`
}

const format = v => Array.isArray(v) ? v.join(" | ") : v
