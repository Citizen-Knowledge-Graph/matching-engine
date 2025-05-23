export class Graph {
    constructor(jsonLd) {
        this.root = new Node("AND", jsonLd["sh:property"].map(walk))
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
    if (obj["sh:not"]) return new Node("NOT", [walk(obj["sh:not"])])
    if (obj["sh:or"]) return new Node("OR", list(obj["sh:or"]).map(walk))
    if (obj["sh:and"]) return new Node("AND", list(obj["sh:and"]).map(walk))

    if (Array.isArray(obj["sh:property"])) return new Node("AND", obj["sh:property"].map(walk))
    if (obj["sh:property"]) return walk(obj["sh:property"])
    if (obj["sh:path"]) return makeRule(obj)

    throw new Error("Unhandled shape fragment:\n" + JSON.stringify(obj, null, 2))
}

function makeRule(p) {
    const rule = Object.fromEntries(
        [
            ["path", p["sh:path"]?.["@id"]],
            ["minInclusive", num(p["sh:minInclusive"])],
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
