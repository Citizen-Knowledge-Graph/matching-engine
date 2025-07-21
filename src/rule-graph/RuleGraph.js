import { shrink } from "@foerderfunke/sem-ops-utils"
import { cleanGraph, graphToMermaid, STATUS } from "./EvalGraph.js"

export class RuleGraph {
    constructor() {
        this.uri = null
        this.rootNodes = {}
        this.containsPointersToTheseShapes = [] // objects of sh:node or sh:qualifiedValueShape predicates
    }
    toTGF() {
        let nodeLines = []
        let edgeLines = []
        const walk = (node) => {
            let nodeLine = `${node.id} ${node.type}`
            if (node.type === TYPE.DATAFIELD) nodeLine += ` ${shrink(node.path)}`
            if (node.type === TYPE.RULE) nodeLine += ` ${JSON.stringify(node.rule)}` // prettify TODO
            nodeLines.push(nodeLine)
            for (const child of node.children || []) {
                edgeLines.push(`${node.id} ${child.id}`)
                walk(child)
            }
        }
        for (let rootNode of Object.values(this.rootNodes)) walk(rootNode)
        return [...nodeLines, "#", ...edgeLines].join("\n")
    }
    clean() { return cleanGraph(this, false) }
    toMermaid(matchingEngine) { return graphToMermaid(this, matchingEngine, false) }
}

export const TYPE = {
    ROOT: "root",
    AND: "sh:and",
    OR: "sh:or",
    NOT: "sh:not",
    DATAFIELD: "datafield",
    RULE: "rule",
}

export class Node {
    constructor(id, type, sourceShape) {
        this.id = id
        this.type = type
        this.sourceShape = sourceShape
        this.eval = { status: STATUS.MISSING }
    }
    addChild(childNode) {
        if (!this.children) this.children = []
        this.children.push(childNode)
    }
}

export class RootNode extends Node {
    constructor(id, type, sourceShape, targetClass) {
        super(id, type, sourceShape)
        this.nodeShapeUri = sourceShape
        this.targetClass = targetClass
        this.individualUri = null
    }
}
