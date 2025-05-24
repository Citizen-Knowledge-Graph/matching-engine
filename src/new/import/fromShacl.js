import { Node } from "../Graph.js"

export function ruleGraphFromShacl(jsonLd) {
    let implicitAndNode = new Node("AND", jsonLd["sh:property"].map(walk))
    return new Node("ROOT", [implicitAndNode])
}

function walk(obj, inheritedPath = null) {
    const path = obj["sh:path"]?.["@id"] ?? inheritedPath
    const children = []

    if (obj["sh:property"]) {
        const ps = Array.isArray(obj["sh:property"]) ? obj["sh:property"] : [obj["sh:property"]]
        children.push(... ps.map(p => walk(p, null)))
    }

    if (obj["sh:not"]) {
        const inner = obj["sh:not"]
        if (isFacetOnly(inner)) {
            children.push(makeRule(inner, path,true))
        } else {
            children.push(new Node("NOT", [walk(inner, path)]))
        }
    }
    if (obj["sh:or"]) children.push(new Node("OR", list(obj["sh:or"]).map(n => walk(n, path))))
    if (obj["sh:and"]) children.push(new Node("AND", list(obj["sh:and"]).map(n => walk(n, path))))

    if (hasFacet(obj)) {
        const rule = makeRule(obj, path)
        if (children.length === 0) return rule
        children.unshift(rule)
    }

    if (children.length === 1) return children[0]
    if (children.length >  1) return new Node("AND", children)  // implicit AND

    throw new Error("Unhandled shape fragment:\n" + JSON.stringify(obj, null, 2))
}

function makeRule(p, inheritedPath, negated = false) {
    const rule = Object.fromEntries(
        [
            ["path", p["sh:path"]?.["@id"] ?? inheritedPath],
            ["minInclusive", num(p["sh:minInclusive"])],
            ["minExclusive", num(p["sh:minExclusive"])],
            ["maxInclusive", num(p["sh:maxInclusive"])],
            ["maxExclusive", num(p["sh:maxExclusive"])],
            ["in", !negated && p["sh:in"] ? list(p["sh:in"]).map(atom) : null],
            ["notIn", negated && p["sh:in"] ? list(p["sh:in"]).map(atom) : null]
        ].filter(([, v]) => v !== null)
    )
    if (!rule.path) throw new Error("No path for rule:\n" + JSON.stringify(p, null, 2))
    return new Node("RULE", [], rule)
}

const FACET_KEYS = new Set(["sh:in","sh:minInclusive","sh:minExclusive","sh:maxInclusive","sh:maxExclusive"])
const LOGIC_KEYS = new Set(["sh:not","sh:or","sh:and","sh:property"])

const hasFacet = o => [... FACET_KEYS].some(k => k in o)
const isFacetOnly = o => ![... LOGIC_KEYS].some(k => k in o) && hasFacet(o)

const list = x => x?.["@list"] ?? []
const num  = lit => lit ? Number(lit["@value"]) : null

function atom(lit) {
    if (lit["@id"]) return lit["@id"]
    const { ["@type"]: t, ["@value"]: v } = lit
    return t?.endsWith("boolean")  ? v === "true" : t?.endsWith("integer") ? Number(v) : v
}
