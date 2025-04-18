import { shrink } from "@foerderfunke/sem-ops-utils"

export class Graph {
    constructor() {
        this.nodes = {}
        this.edges = []
    }

    processQuad(quad) {
        let s = shrink(quad.subject.value)
        let p = shrink(quad.predicate.value)
        let o = shrink(quad.object.value)
        if (!this.nodes[s]) this.nodes[s] = new Node(s)
        if (!this.nodes[o]) this.nodes[o] = new Node(o)
        this.edges.push(new Edge(p, s, o))
    }
}

export class Node {
    constructor(id) {
        this.id = id
    }
}

export class Edge {
    constructor(id, sourceId, targetId) {
        this.id = id
        this.sourceId = sourceId
        this.targetId = targetId
    }
}
