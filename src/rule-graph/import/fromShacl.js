import { NodeAND, NodeCLASS, NodeDATAFIELD, NodeNOT, NodeOR, NodeROOT, NodeRULE } from "../Graph.js"

export const ruleGraphFromShacl = shape => {
    const buildNodeClass = shape => {
        const shapeId = shape["@id"]
        if (shapeId.toLowerCase().includes("flowshape")) return null
        const targetClass = shape["sh:targetClass"]?.["@id"]
        const isMainShape = shape.hasOwnProperty("ff:isMainShape")
        return new NodeCLASS(shapeId, targetClass, isMainShape, [walk(shape)])
    }
    if(!shape["@graph"]) return new NodeROOT([buildNodeClass(shape)])
    let rootChildren = []
    let nodeShapes = shape["@graph"]
    for (let nodeShape of nodeShapes) {
        let nodeClass = buildNodeClass(nodeShape)
        if (nodeClass) rootChildren.push(nodeClass)
    }
    return new NodeROOT(rootChildren)
}

function walk(obj, path = null) {
    path = obj["sh:path"]?.["@id"] ?? path
    const children = []
    if (obj["sh:property"]) {
        children.push(... arr(obj["sh:property"]).map(p => walk(p)))
    }
    const facetLeaves = buildFacetNodes(obj)
    if (obj["sh:not"]) {
        const inner = obj["sh:not"]
        if (canInlineNotIn(inner)) {
            const notLeaf = new NodeNOT([
                ruleNode("sh:InConstraintComponent", list(inner["sh:in"]).map(atom))
            ])
            facetLeaves.push(notLeaf)
        } else {
            children.push(new NodeNOT([walk(inner, path)]))
        }
    }
    if (obj["sh:or"]) {
        children.push(new NodeOR(list(obj["sh:or"]).map(n => walk(n, path))))
    }
    if (obj["sh:and"]) {
        children.push(new NodeAND(list(obj["sh:and"]).map(n => walk(n, path))))
    }
    if (facetLeaves.length) {
        const pathNode = new NodeDATAFIELD(facetLeaves)
        pathNode.path = path
        if (!children.length) return pathNode
        children.unshift(pathNode)
    }
    if (children.length === 1) return children[0]
    if (children.length > 1) return new NodeAND(children)

    if (path) {
        const empty = new NodeDATAFIELD([])
        empty.path  = path
        return empty
    }

    throw new Error("Unhandled fragment:\n" + JSON.stringify(obj, null, 2))
}

function buildFacetNodes(o) {
    const leaves = []
    if (o["sh:in"])           leaves.push(ruleNode("sh:InConstraintComponent",           list(o["sh:in"]).map(atom)))
    if (o["sh:hasValue"])     leaves.push(ruleNode("sh:HasValueConstraintComponent",     atom(o["sh:hasValue"])))
    if (o["sh:maxCount"])     leaves.push(ruleNode("sh:MaxCountConstraintComponent",     num(o["sh:maxCount"])))
    if (o["sh:minInclusive"]) leaves.push(ruleNode("sh:MinInclusiveConstraintComponent", num(o["sh:minInclusive"])))
    if (o["sh:minExclusive"]) leaves.push(ruleNode("sh:MinExclusiveConstraintComponent", num(o["sh:minExclusive"])))
    if (o["sh:maxInclusive"]) leaves.push(ruleNode("sh:MaxInclusiveConstraintComponent", num(o["sh:maxInclusive"])))
    if (o["sh:maxExclusive"]) leaves.push(ruleNode("sh:MaxExclusiveConstraintComponent", num(o["sh:maxExclusive"])))
    if (o["sh:lessThan"])     leaves.push(ruleNode("sh:LessThanConstraintComponent",     atom(o["sh:lessThan"])))
    if (o["sh:node"])         leaves.push(ruleNode("sh:node",                            atom(o["sh:node"])))
    if (o["sh:qualifiedValueShape"]) leaves.push(ruleNode("sh:qualifiedValueShape",      atom(o["sh:qualifiedValueShape"])))
    if (o["sh:minCount"]) {
        let numb = num(o["sh:minCount"])
        if (numb !== 1)       leaves.push(ruleNode("sh:MinCountConstraintComponent",     numb))
    }
    if (o["sh:qualifiedMinCount"]) {
        let numb = num(o["sh:qualifiedMinCount"])
        if (numb !== 1) leaves.push(ruleNode("sh:QualifiedMinCountConstraintComponent",  numb))
    }
    return leaves
}

function ruleNode(type, value) {
    const node = new NodeRULE()
    node.type = type
    node.value = value
    delete node.children
    return node
}

const canInlineNotIn = o => Object.keys(o).every(k => k === "sh:path" || k === "sh:in")
const list = x => x?.["@list"] ?? []
const num  = lit => lit ? Number(lit["@value"]) : null
const arr  = x => (Array.isArray(x) ? x : [x])

function atom(lit) {
    if (lit === null || typeof lit !== "object") return lit
    if (lit["@id"]) return lit["@id"]
    if ("@value" in lit) {
        const val = lit["@value"]
        const type = lit["@type"] || ""
        if (type.endsWith("boolean")) return val === "true"
        if (type.endsWith("integer")) return Number(val)
        return val
    }
    return lit
}
