import { shrink } from "@foerderfunke/sem-ops-utils"

export class RawGraph {
    constructor(quads) {
        this.nodes = {}
        this.edges = []
        for (const quad of quads) {
            // subject
            let subject = quad.subject
            let subjectId = subject.value
            if (subject.termType === "BlankNode") {
                subjectId = "BlankNode_" + subjectId
            }
            if (!this.nodes[subjectId]) {
                this.nodes[subjectId] = new RawNode(subjectId, subject)
            }
            // object
            let object = quad.object
            let objectId = object.value
            if (object.termType === "BlankNode") {
                objectId = "BlankNode_" + objectId
            }
            if (object.termType === "Literal") {
                objectId = "Literal_" + Math.random().toString(36).slice(2, 7)
            }
            if (!this.nodes[objectId]) {
                this.nodes[objectId] = new RawNode(objectId, object)
            }
            // predicate
            let predicate = quad.predicate
            let predicateId = predicate.value
            this.edges.push(new RawEdge(subjectId, objectId, predicateId, predicate))
        }
    }

    toTGF() { // Trivial Graph Format, yEd can open that for instance
        let lines = []
        for (const nodeId in this.nodes) {
            const node = this.nodes[nodeId]
            lines.push(`${node.id} ${node.getLabel()}`)
        }
        lines.push("#")
        for (const edge of this.edges) {
            lines.push(`${edge.sourceId} ${edge.targetId} ${edge.getLabel()}`)
        }
        return lines.join("\n")
    }
}

export class RawNode {
    constructor(id, quadPart) {
        this.id = id
        this.quadPart = quadPart
    }
    getLabel() {
        if (this.quadPart.termType === "BlankNode") {
            return this.id
        } else if (this.quadPart.termType === "Literal") {
            return this.quadPart.value
        } else {
            return shrink(this.quadPart.value)
        }
    }
}

export class RawEdge {
    constructor(sourceId, targetId, id, quadPart) {
        this.sourceId = sourceId
        this.targetId = targetId
        this.id = id
        this.quadPart = quadPart
    }
    getLabel() {
        return shrink(this.quadPart.value)
    }
}
