import { Node } from "../Graph.js"

export function ruleGraphFromShacl(shape) {
    const props = shape["sh:property"] ?? []
    return new Node("ROOT", [new Node("AND", asArray(props).map(walk))])
}

function walk(obj, path = null) {
    path = obj["sh:path"]?.["@id"] ?? path
    const children = []
    if (obj["sh:property"]) {
        children.push(... asArray(obj["sh:property"]).map(p => walk(p)))
    }
    if (obj["sh:not"]) {
        const inner = obj["sh:not"]
        children.push(
            canInlineNotIn(inner)
                ? makeRule(inner, path, true)
                : new Node("NOT", [walk(inner, path)])
        )
    }
    for (const op of ["sh:or", "sh:and"]) {
        if (obj[op]) {
            children.push(new Node(op.slice(3).toUpperCase(), list(obj[op]).map(n => walk(n, path))))
        }
    }
    if (hasFacet(obj)) {
        const rule = makeRule(obj, path)
        if (!children.length) return rule
        children.unshift(rule)
    }
    return children.length > 1 ? new Node("AND", children) : children[0]
}

function makeRule(p, path, neg = false) {
    const rule = Object.fromEntries(
        [
            ["path", p["sh:path"]?.["@id"] ?? path],
            ["minCount", num(p["sh:minCount"])],
            ["maxCount", num(p["sh:maxCount"])],
            ["minInclusive", num(p["sh:minInclusive"])],
            ["minExclusive", num(p["sh:minExclusive"])],
            ["maxInclusive", num(p["sh:maxInclusive"])],
            ["maxExclusive", num(p["sh:maxExclusive"])],
            ["in", !neg && p["sh:in"] ? list(p["sh:in"]).map(atom) : null],
            ["notIn", neg && p["sh:in"] ? list(p["sh:in"]).map(atom) : null]
        ].filter(([, v]) => v !== null)
    )
    if (!rule.path) throw new Error("No path for rule:\n" + JSON.stringify(p))
    return new Node("RULE", [], rule)
}

const FACET_KEYS = new Set(["sh:in", "sh:minInclusive", "sh:minExclusive", "sh:maxInclusive", "sh:maxExclusive", "sh:minCount", "sh:maxCount"])

const hasFacet = o => [... FACET_KEYS].some(k => k in o)
const canInlineNotIn = o => Object.keys(o).every(k => k === "sh:path" || k === "sh:in")

const list = x => x?.["@list"] ?? []
const num = lit => lit ? Number(lit["@value"]) : null
const asArray = x => (Array.isArray(x) ? x : [x])

function atom(lit) {
    if (lit["@id"]) return lit["@id"]
    const { ["@type"]: t, ["@value"]: v } = lit
    return t?.endsWith("boolean") ? v === "true" : t?.endsWith("integer") ? Number(v) : v
}
