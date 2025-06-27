import { expand, shrink } from "@foerderfunke/sem-ops-utils"
import { RuleGraph } from "./RuleGraph.js"

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
            this.edges.push(new RawEdge(this.nodes[subjectId], this.nodes[objectId], predicateId, predicate))
            // incoming/outgoing flags
            this.nodes[subjectId].hasOutgoing = true
            this.nodes[objectId].hasIncoming = true
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
            lines.push(`${edge.source.id} ${edge.target.id} ${edge.getLabel()}`)
        }
        return lines.join("\n")
    }

    toRuleGraph() {
        let ruleGraph = new RuleGraph()
        ruleGraph.rpUri = this.edges.find(edge => edge.target.id === expand("ff:RequirementProfile")).source.id
        let mainShapeUri = this.edges.find(edge => edge.id === expand("ff:hasMainShape"))?.target.id
        let nodeShapes = this.edges.filter(edge => edge.target.id === expand("sh:NodeShape")).map(edge => edge.source)
        for (let nodeShape of nodeShapes) {
            let subgraph = this.buildSubgraph(nodeShape)
            subgraph.isMainShape = nodeShape.id === mainShapeUri
            ruleGraph.classes[subgraph.targetClassUri] = subgraph
        }
        return ruleGraph
    }

    buildSubgraph(nodeShape) {
        let subgraph = new RuleGraph()
        subgraph.targetClassUri = this.edges.find(edge => edge.source === nodeShape && edge.id === expand("sh:targetClass"))?.target.id
        let outgoingEdges = this.edges.filter(edge => edge.source === nodeShape)
        // TODO
        return subgraph
    }
}

export class RawNode {
    constructor(id, quadPart) {
        this.id = id
        this.quadPart = quadPart
        this.hasIncoming = false
        this.hasOutgoing = false
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
    constructor(source, target, id, quadPart) {
        this.source = source
        this.target = target
        this.id = id
        this.quadPart = quadPart
    }
    getLabel() {
        return shrink(this.quadPart.value)
    }
}
