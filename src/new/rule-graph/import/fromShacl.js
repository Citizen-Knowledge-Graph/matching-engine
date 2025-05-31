import { Node } from "../Graph.js"

export const ruleGraphFromShacl = shape => new Node("ROOT", [walk(shape)])

function walk(obj, path = null) {
    path = obj["sh:path"]?.["@id"] ?? path
    const children = []
    if (obj["sh:property"]) {
        children.push(... arr(obj["sh:property"]).map(p => walk(p)))
    }
    if (obj["sh:not"]) {
        const inner = obj["sh:not"]
        if (canInlineNotIn(inner)) {
            children.push(new Node("NOT", [constraintNode("IN", list(inner["sh:in"]).map(atom))]))
        } else {
            children.push(new Node("NOT", [walk(inner, path)]))
        }
    }
    for (const [k, lbl] of [["sh:or", "OR"], ["sh:and", "AND"]]) {
        if (obj[k]) children.push(new Node(lbl, list(obj[k]).map(n => walk(n, path))))
    }
    const facetLeaves = buildFacetNodes(obj)
    if (facetLeaves.length) {
        const pathNode = new Node("RULE",
            facetLeaves.length === 1 ? facetLeaves
                : [new Node("AND", facetLeaves)]
        )
        pathNode.path = path
        if (!children.length) return pathNode
        children.unshift(pathNode)
    }
    if (children.length === 1) return children[0]
    if (children.length >  1) return new Node("AND", children)
    throw new Error("Unhandled fragment:\n" + JSON.stringify(obj, null, 2))
}

function buildFacetNodes(o) {
    const leaves = []
    if (o["sh:in"])           leaves.push(constraintNode("IN", list(o["sh:in"]).map(atom)))
    if (o["sh:hasValue"])     leaves.push(constraintNode("HAS_VALUE", atom(o["sh:hasValue"])))
    if (o["sh:minCount"])     leaves.push(constraintNode("MIN_COUNT", num(o["sh:minCount"])))
    if (o["sh:maxCount"])     leaves.push(constraintNode("MAX_COUNT", num(o["sh:maxCount"])))
    if (o["sh:minInclusive"]) leaves.push(constraintNode("MIN_INC",  num(o["sh:minInclusive"])))
    if (o["sh:minExclusive"]) leaves.push(constraintNode("MIN_EXC",  num(o["sh:minExclusive"])))
    if (o["sh:maxInclusive"]) leaves.push(constraintNode("MAX_INC",  num(o["sh:maxInclusive"])))
    if (o["sh:maxExclusive"]) leaves.push(constraintNode("MAX_EXC",  num(o["sh:maxExclusive"])))
    return leaves
}

function constraintNode(kind, value) {
    const n = new Node(kind, [])
    n.value = value
    return n
}

const canInlineNotIn = o => Object.keys(o).every(k => k === "sh:path" || k === "sh:in")
const list = x => x?.["@list"] ?? []
const num  = lit => lit ? Number(lit["@value"]) : null
const arr  = x => (Array.isArray(x) ? x : [x])

function atom(lit) {
    if (lit["@id"]) return lit["@id"]
    const { ["@type"]: t, ["@value"]: v } = lit
    return t?.endsWith("boolean") ? v === "true" : t?.endsWith("integer") ? Number(v) : v
}
