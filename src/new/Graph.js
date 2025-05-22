import { shrink } from "@foerderfunke/sem-ops-utils"

export class Graph {
    constructor() {
        this.nodes = {}
        this.edges = []
    }

    processQuad(quad) {
        // subject
        let sVal = quad.subject.value
        let sId = shrink(sVal)
        let sType = quad.subject.constructor.name
        if (!this.nodes[sId]) this.nodes[sId] = new Node(sId, sVal, sType)
        // object
        let oVal = quad.object.value
        let oId = shrink(oVal)
        let oType = quad.object.constructor.name
        if (oType === "Literal") {
            oId = oVal + "_" + Math.random().toString(36).slice(2, 6)
            this.nodes[oId] = new Node(oId, oVal, oType)
        } else {
            if (!this.nodes[oId]) this.nodes[oId] = new Node(oId, oVal, oType)
        }
        // predicate
        let pVal = quad.predicate.value
        let pId = shrink(pVal)
        this.edges.push(new Edge(pId, pVal, sId, oId))

        this.nodes[sId].addChild(oId)
    }
}

export class Node {
    constructor(id, value, type) {
        this.id = id
        this.value = value
        this.type = type
        this.children = []
    }
    addChild(child) {
        this.children.push(child)
    }
}

export class Edge {
    constructor(id, value, sourceId, targetId) {
        this.id = id
        this.value = value
        this.sourceId = sourceId
        this.targetId = targetId
    }
}
