
export class Graph {
    constructor(root) {
        this.root = root
        this.conforms = null
    }
    eval() {
        this.conforms = this.root.eval()
    }
}

export class Node {
    constructor(children = []) {
        this.children = children
    }
    eval() {
        let ok = true
        for (const child of this.children) {
            ok = child.eval() && ok
        }
        this.treeEvalIsOk = ok
        return ok
    }
}

export class NodeROOT extends Node {}
export class NodeAND extends Node {}
export class NodeDATAFIELD extends Node {}

export class NodeOR extends Node {
    eval() {
        let ok = false
        for (const child of this.children) {
            ok = child.eval() || ok // no early exit, visit all
        }
        this.treeEvalIsOk = ok
        return ok
    }
}

export class NodeNOT extends Node {
    eval() {
        const childResult = this.children[0]?.eval() ?? true
        let ok = !childResult
        this.treeEvalIsOk = ok
        return ok
    }
}

export class NodeRULE extends Node {
    eval() {
        return this.shaclEval?.isOk
    }
}
