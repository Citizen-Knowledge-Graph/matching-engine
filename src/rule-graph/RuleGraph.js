
export class RuleGraph {
    constructor() {
        this.uri = null
        this.isMainShape = false
        this.targetClassUri = null
        this.root = null
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
