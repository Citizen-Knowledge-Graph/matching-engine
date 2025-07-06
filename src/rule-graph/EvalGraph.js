import { shrink } from "@foerderfunke/sem-ops-utils"
import { TYPE } from "./RuleGraph.js"

export const STATUS = {
    OK: "ok",
    VIOLATION: "violation",
    MISSING: "missing"
}

const { OK, VIOLATION, MISSING } = STATUS

function andStatus(a, b) {
    if (a === VIOLATION || b === VIOLATION) return VIOLATION
    if (a === MISSING || b === MISSING) return MISSING
    return OK
}

function orStatus(a, b) {
    if (a === OK || b === OK) return OK
    if (a === MISSING || b === MISSING) return MISSING
    return VIOLATION
}

function notStatus(a) {
    if (a === OK) return VIOLATION
    if (a === VIOLATION) return OK
    return MISSING
}

export const getStatus = (severity) => {
    switch (severity) {
        case "https://schemas.link/shacl-next#Debug":
            return STATUS.OK
        case "http://www.w3.org/ns/shacl#Violation":
            return STATUS.VIOLATION
        default:
            return STATUS.MISSING
    }
}

const constraintComponentMapping = {
    "sh:minCount": "sh:MinCountConstraintComponent",
    "sh:maxCount": "sh:MaxCountConstraintComponent",
    "sh:minInclusive": "sh:MinInclusiveConstraintComponent",
    "sh:minExclusive": "sh:MinExclusiveConstraintComponent",
    "sh:maxInclusive": "sh:MaxInclusiveConstraintComponent",
    "sh:maxExclusive": "sh:MaxExclusiveConstraintComponent",
    "sh:lessThan": "sh:LessThanConstraintComponent",
    "sh:hasValue": "sh:HasValueConstraintComponent",
    "sh:node": "sh:NodeConstraintComponent",
    "sh:qualifiedValueShape": "sh:QualifiedValueShapeConstraintComponent",
    "sh:qualifiedMinCount": "sh:QualifiedMinCountConstraintComponent",
    "sh:in": "sh:InConstraintComponent",
    "sh:or": "sh:OrConstraintComponent",
    "sh:and": "sh:AndConstraintComponent",
    "sh:not": "sh:NotConstraintComponent"
}

// usable for RuleGraph and EvalGraph
export const cleanGraph = (graph, isEvalGraph) => {
    const cleanMsg = (msg) => {
        // Example: Value is not greater than or equal to "15"^^<http://www.w3.org/2001/XMLSchema#integer>
        msg = msg.replace(/"([^"]+)"\^\^<[^>]+>/g, (_, value) => value)
        // Example: Missing expected value <https://foerderfunke.org/default#something>
        msg = msg.replace(/<([^>]+)>/g, (_, url) => shrink(url))
        return msg
    }
    const walk = (node) => {
        /*// delete "sh:minCount 1" rule nodes
        if (node.children && node.children.length) {
            for (let i = node.children.length - 1; i >= 0; i--) {
                const child = node.children[i]
                if (child.rule && child.rule.type === "sh:minCount" && child.rule.value.toString() === "1") {
                    node.children.splice(i, 1)
                }
            }
        }*/
        // delete unnecessary properties
        // delete node.id
        delete node.sourceShape
        delete node.nodeShapeUri
        if (node.path) node.path = shrink(node.path)
        if (node.eval.message) node.eval.message = cleanMsg(node.eval.message)
        if (!isEvalGraph) delete node.eval
        for (let child of node.children || []) walk(child)
    }
    graph.rootNodes = Object.values(graph.rootNodes)
    for (let root of graph.rootNodes) {
        root.class = shrink(root.targetClass)
        delete root.targetClass
        if (isEvalGraph) root.individual = shrink(root.individualUri)
        delete root.individualUri
        walk(root)
    }
    delete graph.isEvalGraph
    delete graph.mainShape
}

// usable for RuleGraph and EvalGraph
// to be called after cleanGraph(): rootNodes is expected to be an array
export const graphToMermaid = (graph, isEvalGraph) => {
    let lines  = ["flowchart TD"]
    const toLabel = (node) => {
        switch (node.type) {
            case TYPE.ROOT:
                if (isEvalGraph) {
                    return `("${node.individual} (${node.class})")`
                }
                return `(${node.class})`
            case TYPE.AND:
                return `(AND)`
            case TYPE.OR:
                return `(OR)`
            case TYPE.NOT:
                return `(NOT)`
            case TYPE.DATAFIELD:
                return `(${node.path})`
            case TYPE.RULE:
                let label
                if (node.rule.type === "sh:in") {
                    label = `("${node.rule.type} [${node.rule.values.join(", ")}]"`
                } else {
                    label = `(${node.rule.type} ${node.rule.value}`
                }
                if (!node.eval) return label + ")"
                if (node.eval.message) {
                    label += `</br><span style="font-size:0.8em">${node.eval.message}`
                    if (node.eval.value) label += `: ${node.eval.value}`
                    label += "</span>"
                }
                return label + ")"
            default:
                throw new Error(`Unknown node type: ${node.type}`)
        }
    }
    const walk = (node, char) => {
        let nodeId = `${char}${node.id}`
        lines.push(`${nodeId}${toLabel(node)}`)
        if (isEvalGraph && node.eval) lines.push(`class ${nodeId} ${node.eval.status}`)
        for (let child of node.children || []) {
            lines.push(`${nodeId} --> ${char}${child.id}`)
            walk(child, char)
        }
    }
    const incrementChar = (char) => {
        return String.fromCharCode(char.charCodeAt(0) + 1)
    }
    let char = "A"
    for (let rootNode of graph.rootNodes) {
        walk(rootNode, char)
        char = incrementChar(char)
    }
    if (isEvalGraph) {
        lines.push("classDef ok fill:#2ecc71,stroke:#0e8046,stroke-width:2px")
        lines.push("classDef violation fill:#ff4136,stroke:#ad0e05,stroke-width:2px")
        lines.push("classDef missing fill:#d9d9d9,stroke:#6e6e6e,stroke-width:2px")
    }
    return lines.join("\n")
}

export class EvalGraph {
    constructor(ruleGraph, individuals) {
        this.uri = ruleGraph.uri
        this.rootNodes = {}
        for (let [indiv, cls] of Object.entries(individuals)) {
            let clonedRootNode = structuredClone(ruleGraph.rootNodes[cls])
            clonedRootNode.individualUri = indiv
            this.rootNodes[indiv] = clonedRootNode
        }
    }
    eval(validationResults) {
        const walk = (parent, node, valiRes) => {
            let thisConstraintComponent = constraintComponentMapping[node.type === "rule" ? node.rule.type : node.type]
            if (node.sourceShape === valiRes.sourceShapeUri && thisConstraintComponent === shrink(valiRes.constraintComponent)) {
                let status = getStatus(valiRes.severity)
                node.eval.status = status
                if (status === STATUS.VIOLATION) {
                    if (valiRes.resultMessage) node.eval.message = valiRes.resultMessage
                    if (valiRes.value) node.eval.value = valiRes.value
                }
            }
            for (let child of node.children || []) walk(parent, child, valiRes)
        }
        for (let valiRes of validationResults) {
            if (!valiRes.focusNode) {
                console.error(`Missing focusNode: ${JSON.stringify(valiRes)}, skipping validation result`)
                continue
            }
            let individualRootNode = this.rootNodes[valiRes.focusNode]
            if (!individualRootNode) {
                console.error(`No root node found for focusNode ${valiRes.focusNode}, skipping validation result`)
                continue
            }
            walk(null, individualRootNode, valiRes)
        }
        // postprocessing
        // can't do this as function on the Node, because the functions get lost during structuredClone()
        const recursiveEval = node => {
            switch(node.type) {
                case TYPE.ROOT:
                case TYPE.DATAFIELD:
                case TYPE.AND:
                    node.eval = { status: OK }
                    for (const child of node.children) node.eval.status = andStatus(node.eval.status, recursiveEval(child))
                    break;
                case TYPE.OR:
                    node.eval = { status: VIOLATION }
                    for (const child of node.children) node.eval.status = orStatus(node.eval.status, recursiveEval(child))
                    break
                case TYPE.NOT:
                    // do the same as AND, but then invert
                    node.eval = { status: OK }
                    for (const child of node.children) node.eval.status = andStatus(node.eval.status, recursiveEval(child))
                    node.eval.status = notStatus(node.eval.status)
                    break
                case TYPE.RULE:
                    break // no children & eval was set above via validationResults
                default:
                    throw new Error(`Unknown node type: ${node.type}`)
            }
            return node.eval.status
        }
        // this will overwrite eval of all non-rule nodes, might skip those in walk() already above?
        for (let root of Object.values(this.rootNodes)) recursiveEval(root)
    }
    clean() { cleanGraph(this, true) }
    toMermaid() { return graphToMermaid(this, true) }
}
