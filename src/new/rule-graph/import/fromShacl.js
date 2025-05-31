import { Node } from "../Graph.js"

export const ruleGraphFromShacl = shape => new Node("ROOT", [walk(shape)])

function walk(obj, path = null) {
    path = obj["sh:path"]?.["@id"] ?? path
    const children = []
    if (obj["sh:property"]) {
        children.push(... asArray(obj["sh:property"]).map(p => walk(p)))
    }
    if (obj["sh:not"]) {
        const inner = obj["sh:not"]
        children.push(new Node("NOT", [walk(inner, path)]))
    }
    for (const [key, label] of [["sh:or", "OR"], ["sh:and", "AND"]]) {
        if (obj[key]) children.push(new Node(label, list(obj[key]).map(n => walk(n, path))))
    }
    if (hasFacet(obj)) {
        const rule = makeRule(obj, path)
        if (!children.length) return rule
        children.unshift(rule)
    }
    if (children.length === 1) return children[0]
    if (children.length >  1) return new Node("AND", children)
    throw new Error("Unhandled fragment:\n" + JSON.stringify(obj, null, 2))
}

function makeRule(p, inheritedPath) {
    const rule = Object.fromEntries(
        [
            ["path", p["sh:path"]?.["@id"] ?? inheritedPath],
            ["minCount", num(p["sh:minCount"])],
            ["maxCount", num(p["sh:maxCount"])],
            ["minInclusive", num(p["sh:minInclusive"])],
            ["minExclusive", num(p["sh:minExclusive"])],
            ["maxInclusive", num(p["sh:maxInclusive"])],
            ["maxExclusive", num(p["sh:maxExclusive"])],
            ["in", p["sh:in"] ? list(p["sh:in"]).map(atom) : null],
            ["hasValue", p["sh:hasValue"] ? atom(p["sh:hasValue"]) : null],
            // TODO add more
        ].filter(([, v]) => v != null)
    )
    if (!rule.path) throw new Error("No path for rule:\n" + JSON.stringify(p))
    return new Node("RULE", [], rule)
}

const FACET_KEYS = new Set(["sh:hasValue", "sh:in", "sh:minInclusive", "sh:minExclusive", "sh:maxInclusive", "sh:maxExclusive", "sh:minCount", "sh:maxCount"])

const hasFacet = o => [... FACET_KEYS].some(k => k in o)

const list = x => x?.["@list"] ?? []
const num = lit => lit ? Number(lit["@value"]) : null
const asArray = x => (Array.isArray(x) ? x : [x])

function atom(lit) {
    if (lit["@id"]) return lit["@id"]
    const { ["@type"]: t, ["@value"]: v } = lit
    return t?.endsWith("boolean") ? v === "true" : t?.endsWith("integer") ? Number(v) : v
}
