import { expand, shrink } from "@foerderfunke/sem-ops-utils"
import { RuleGraph, Node, TYPE } from "./RuleGraph.js"

const isRdfFirst = id => id === expand("rdf:first")
const isRdfRest = id => id === expand("rdf:rest")

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
        ruleGraph.uri = this.edges.find(edge => edge.target.id === expand("ff:RequirementProfile")).source.id
        ruleGraph.subgraphs = {}
        let mainShapeUri = this.edges.find(edge => edge.id === expand("ff:hasMainShape"))?.target.id
        let nodeShapes = this.edges.filter(edge => edge.target.id === expand("sh:NodeShape")).map(edge => edge.source)
        for (let nodeShape of nodeShapes) {
            let subgraph = this.buildSubgraph(nodeShape)
            subgraph.isMainShape = nodeShape.id === mainShapeUri
            ruleGraph.subgraphs[subgraph.targetClassUri] = subgraph
        }
        return ruleGraph
    }

    buildSubgraph(nodeShape) {
        let subgraph = new RuleGraph()
        subgraph.uri = nodeShape.id
        subgraph.targetClassUri = this.edges.find(edge => edge.source === nodeShape && edge.id === expand("sh:targetClass"))?.target.id
        subgraph.root = new Node(TYPE.ROOT, nodeShape.id)

        const walk = (rawNode, viaEdge, parent, parentRawNode) => {
            if (viaEdge) {
                if (viaEdge.id === expand("sh:in")) {
                    let node = new Node(TYPE.RULE, parentRawNode.id)
                    node.rule = {
                        type: "sh:in",
                        values: this.collectList(rawNode)
                    }
                    parent.addChild(node)
                }
                if ([expand("sh:or"),
                    expand("sh:and")
                ].includes(viaEdge.id)) {
                    let node = new Node(viaEdge.id === expand("sh:or") ? TYPE.OR : TYPE.AND, parentRawNode.id)
                    parent.addChild(node)
                    parent = node
                }
                if (viaEdge.id === expand("sh:not")) {
                    let node = new Node(TYPE.NOT, parentRawNode.id)
                    parent.addChild(node)
                    parent = node
                }
                if ([expand("sh:hasValue"),
                    expand("sh:minCount"),
                    expand("sh:maxCount"),
                    expand("sh:minInclusive"),
                    expand("sh:minExclusive"),
                    expand("sh:maxInclusive"),
                    expand("sh:maxExclusive"),
                    expand("sh:lessThan"),
                    expand("sh:node"),
                    expand("sh:qualifiedValueShape"),
                    expand("sh:qualifiedMinCount")
                ].includes(viaEdge.id)) {
                    let node = new Node(TYPE.RULE, parentRawNode.id)
                    node.rule = {
                        type: shrink(viaEdge.id),
                        value: rawNode.getLabel()
                    }
                    parent.addChild(node)
                }
            }

            const outgoing = this.edges.filter(e => e.source === rawNode).sort((a, b) => (isRdfFirst(b.id) - isRdfFirst(a.id)))

            let pathEdge = outgoing.find(edge => edge.id === expand("sh:path"))
            if (pathEdge) {
                let node = new Node(TYPE.DATAFIELD, rawNode.id)
                node.path = pathEdge.target.id
                parent.addChild(node)
                parent = node
            }

            for (const edge of outgoing) walk(edge.target, edge, parent, rawNode)
        }

        walk(nodeShape, null, subgraph.root, null)
        return subgraph
    }

    collectList(head) {
        const items = []
        let current = head
        while (current && current.id !== expand("rdf:nil")) {
            const firstEdge = this.edges.find(edge => edge.source === current && isRdfFirst(edge.id))
            items.push(firstEdge.target.getLabel())
            const restEdge = this.edges.find(edge => edge.source === current && isRdfRest(edge.id))
            current = restEdge ? restEdge.target : null;
        }
        return items
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
