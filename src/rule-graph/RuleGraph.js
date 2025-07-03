import { shrink } from "@foerderfunke/sem-ops-utils"

export class RuleGraph {
    constructor() {
        this.uri = null
        this.mainShape = null
        this.rootNodes = {}
    }
    toTGF() {
        let nodeLines = []
        let edgeLines = []
        const walk = (node) => {
            let nodeLine = `${node.id} ${node.type}`
            if (node.type === TYPE.DATAFIELD) nodeLine += ` ${shrink(node.path)}`
            if (node.type === TYPE.RULE) nodeLine += ` ${JSON.stringify(node.rule)}` // prettify TODO
            nodeLines.push(nodeLine)
            if (!node.children) return
            for (const child of node.children) {
                edgeLines.push(`${node.id} ${child.id}`)
                walk(child)
            }
        }
        for (let rootNode of Object.values(this.rootNodes)) walk(rootNode)
        return [...nodeLines, "#", ...edgeLines].join("\n")
    }
}

export const TYPE = {
    ROOT: "root",
    AND: "and",
    OR: "or",
    NOT: "not",
    DATAFIELD: "datafield",
    RULE: "rule",
}

export class Node {
    constructor(id, type, sourceShape) {
        this.id = id
        this.type = type
        this.sourceShape = sourceShape
    }
    addChild(childNode) {
        if (!this.children) this.children = []
        this.children.push(childNode)
    }
}

export class RootNode extends Node {
    constructor(id, type, sourceShape, targetClass) {
        super(id, type, sourceShape)
        this.uri = sourceShape
        this.targetClass = targetClass
    }
}
