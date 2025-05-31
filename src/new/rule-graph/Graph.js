
export class Graph {
    constructor(root) {
        this.root = root
        this.nodes = {}
        this.leaves = []
        this.counter = 0
        this.tagIds(this.root)
    }

    tagIds(node, parentId = null) {
        let id = `n${++ this.counter}`
        node.id = id
        node.parentId = parentId
        this.nodes[id] = node
        if (!node.children || node.children.length === 0) this.leaves.push(node);
        (node.children ?? []).forEach(child => this.tagIds(child, node.id))
    }

    getUpstreamPath(node) {
        while (node?.parentId) {
            node = this.nodes[node.parentId]
            if (node?.path) return node.path
        }
        return null
    }
}

export class Node {
    constructor(children) {
        if (children && children.length > 0) this.children = children
    }
}

export class NodeROOT extends Node {
    constructor(children) { super(children) }
}

export class NodeAND extends Node {
    constructor(children) { super(children) }
}

export class NodeOR extends Node {
    constructor(children) { super(children) }
}

export class NodeNOT extends Node {
    constructor(children) { super(children) }
}

export class NodeDATAFIELD extends Node {
    constructor(children) { super(children) }
}

export class NodeRULE extends Node {
    constructor() { super() }
}
