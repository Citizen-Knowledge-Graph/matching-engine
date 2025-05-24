
export class Graph {
    constructor(root) {
        this.root = root
    }
}

export class Node {
    constructor(type, children, rule) {
        this.type = type
        if (children.length > 0) this.children = children
        if (rule) this.rule = rule
    }
}
