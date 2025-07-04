import { shrink } from "@foerderfunke/sem-ops-utils"

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
    eval(rows) {
        const walk = (parent, node, row) => {
            let constraintComponent = constraintComponentMapping[node.type === "rule" ? node.rule.type : node.type]
            if (node.sourceShape === row.sourceShape && constraintComponent === shrink(row.type)) {
                node.eval = getStatus(row.severity)
            }
            if (!node.children) return
            for (let child of node.children) walk(parent, child, row)
        }
        for (let row of rows) walk(null, this.rootNodes[row.individual], row)
    }
}
