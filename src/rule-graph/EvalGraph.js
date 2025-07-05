import { shrink } from "@foerderfunke/sem-ops-utils"
import { TYPE } from "./RuleGraph.js"

export const STATUS = {
    OK: "ok",
    VIOLATION: "violation",
    MISSING: "missing"
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

export class EvalGraph {
    constructor(ruleGraph, individuals) {
        this.rootNodes = {}
        for (let [indiv, cls] of Object.entries(individuals)) {
            let clonedRootNode = structuredClone(ruleGraph.rootNodes[cls])
            clonedRootNode.individualUri = indiv
            this.rootNodes[indiv] = clonedRootNode
        }
    }
    eval(validationResults) {
        let datafieldNodes = []
        const walk = (parent, node, valiRes) => {
            if (node.type === TYPE.DATAFIELD) datafieldNodes.push(node)
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
        const determineStatusViaChildren = node => {
            let status = STATUS.OK
            for (let child of node.children || []) {
                // this is our indicator for missing data, it does not count as violation
                if (child.rule && child.rule.type === "sh:minCount" && child.rule.value.toString() === "1") continue
                if (child.eval.status === STATUS.VIOLATION) {
                    status = STATUS.VIOLATION
                    break
                } else if (child.eval.status === STATUS.MISSING) {
                    status = STATUS.MISSING
                }
            }
            node.eval.status = status
        }
        for (let datafieldNode of datafieldNodes) determineStatusViaChildren(datafieldNode)
        for (let rootNode of Object.values(this.rootNodes)) determineStatusViaChildren(rootNode)
    }
    clean() {
        const cleanMsg = (msg) => {
            // Example: Value is not greater than or equal to "15"^^<http://www.w3.org/2001/XMLSchema#integer>
            msg = msg.replace(/"([^"]+)"\^\^<[^>]+>/g, (_, value) => value)
            // Example: Missing expected value <https://foerderfunke.org/default#something>
            msg = msg.replace(/<([^>]+)>/g, (_, url) => shrink(url))
            return msg
        }
        const walk = (node) => {
            delete node.id
            delete node.sourceShape
            delete node.nodeShapeUri
            if (node.path) node.path = shrink(node.path)
            if (node.eval.message) node.eval.message = cleanMsg(node.eval.message)
            for (let child of node.children || []) walk(child)
        }
        this.rootNodes = Object.values(this.rootNodes)
        for (let root of this.rootNodes) {
            root.class = shrink(root.targetClass)
            delete root.targetClass
            root.individual = shrink(root.individualUri)
            delete root.individualUri
            walk(root)
        }
    }
}
