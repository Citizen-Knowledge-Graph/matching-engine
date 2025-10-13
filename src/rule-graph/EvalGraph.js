import { getRdf, shrink } from "@foerderfunke/sem-ops-utils"
import { TYPE } from "./RuleGraph.js"
import grapoi from "grapoi"

const ns = {
    rdfs: getRdf().namespace("http://www.w3.org/2000/01/rdf-schema#"),
    ff: getRdf().namespace("https://foerderfunke.org/default#")
}

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

const cleanMsg = (msg) => {
    // Example: Value is not greater than or equal to "15"^^<http://www.w3.org/2001/XMLSchema#integer>
    msg = msg.replace(/"([^"]+)"\^\^<[^>]+>/g, (_, value) => value)
    // Example: Missing expected value <https://foerderfunke.org/default#something>
    msg = msg.replace(/<([^>]+)>/g, (_, url) => shrink(url))
    msg = msg.replaceAll("https://foerderfunke.org/default#", "ff:")
    return msg
}

// usable for RuleGraph and EvalGraph
export const cleanGraph = (graph) => {
    const walk = (node) => {
        // delete "sh:minCount 1" rule nodes
        if (node.children && node.children.length) {
            for (let i = node.children.length - 1; i >= 0; i--) {
                const child = node.children[i]
                if (child.rule && child.rule.type === "sh:minCount" && child.rule.value.toString() === "1") {
                    node.children.splice(i, 1)
                }
            }
        }
        // delete unnecessary properties
        // delete node.id
        delete node.sourceShape
        // delete node.nodeShapeUri
        if (node.path) node.path = shrink(node.path)
        if (node.eval.message) node.eval.message = cleanMsg(node.eval.message)
        if (!graph.isEvalGraph) delete node.eval
        for (let child of node.children || []) walk(child)
    }
    graph.rootNodes = Object.values(graph.rootNodes)
    for (let root of graph.rootNodes) {
        root.class = shrink(root.targetClass)
        delete root.targetClass
        if (graph.isEvalGraph) root.individual = shrink(root.individualUri)
        delete root.individualUri
        walk(root)
    }
    return graph
}

const dict = {
    AND: { en: "and", de: "und" },
    OR: { en: "or", de: "entweder" },
    NOT: { en: "can't be", de: "darf nicht sein" },
    shInMultiple: { en: "has to be one of:", de: "muss eines davon sein:" },
    shInOne: { en: "has to be:", de: "benötigt:" },
    "sh:minExclusive": { en: "greater than:", de: "größer als:" },
    "sh:maxExclusive": { en: "less than:", de: "kleiner als:" },
    "sh:minInclusive": { en: "at least:", de: "mindestens:" },
    "sh:maxInclusive": { en: "maximally:", de: "maximal:" },
    "sh:lessThan": { en: "less than the value of:", de: "kleiner als der Wert von:" },
    true: { en: "yes", de: "ja" },
    false: { en: "no", de: "nein" },
    "ff:Citizen": { en: "Citizen", de: "Bürger*in" }
}

const print = (key, lang) => {
    if (dict[key]) return dict[key][lang]
    return key
}

const datafieldToLabel = (shortenedDf, matchingEngine, lang) => {
    if (!matchingEngine) return shortenedDf
    if (!shortenedDf.startsWith("ff:")) {
        let key = shortenedDf.toLowerCase()
        if (["true", "false"].includes(key)) return print(key, lang)
        return shortenedDf
    } // then it's a literal and not a datafield
    let localName = shortenedDf.split(":").pop()
    return grapoi({dataset: matchingEngine.defDataset, term: ns.ff[localName]})
        .out(ns.rdfs.label)
        .best(getRdf().score.language([lang]))?.value
}

// usable for RuleGraph and EvalGraph
// to be called after cleanGraph(): rootNodes is expected to be an array
// feature wish list: dotted lines around sh:deactivated shapes
export const graphToMermaid = (graph, matchingEngine = null, printLabels = false, orientationVertical = true) => {
    let lang = !matchingEngine ? "en" : matchingEngine.lang
    let lines = ["flowchart " + (orientationVertical ? "TD" : "LR")]
    const toLabel = (node) => {
        switch (node.type) {
            case TYPE.ROOT:
                let classLabel = `${node.class}`
                if (graph.containsPointersToTheseShapes.includes(node.nodeShapeUri)) classLabel += ` | ${shrink(node.nodeShapeUri)}`
                if (graph.isEvalGraph) return `("${node.individual} (${classLabel})")`
                return `(${print(classLabel, lang)})`
            case TYPE.AND:
                return `(${print("AND", lang)})`
            case TYPE.OR:
                return `(${print("OR", lang)})`
            case TYPE.NOT:
                return `(${print("NOT", lang)})`
            case TYPE.DATAFIELD:
                if (printLabels) {
                    let label = datafieldToLabel(node.path, matchingEngine, lang)
                    if (label) return `(${label})`
                }
                return `(${node.path})`
            case TYPE.RULE:
                let label
                if (node.rule.type === "sh:in") {
                    if (node.rule.values.length <= 1) {
                        label = `(${print("shInOne", lang)} ${datafieldToLabel(node.rule.values[0], matchingEngine, lang)}`
                    } else {
                        label = `("${print("shInMultiple", lang)} [${node.rule.values.map(val => datafieldToLabel(val, matchingEngine, lang)).join(", ")}]"`
                    }
                } else {
                    label = `(${print(node.rule.type, lang)} ${node.rule.value}`
                }
                if (!node.eval) return label + ")"
                if (node.eval.message) {
                    label += `</br><span style="font-size:0.8em">${cleanMsg(node.eval.message)}`
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
        if (graph.isEvalGraph && node.eval) lines.push(`class ${nodeId} ${node.eval.status}`)
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
    if (graph.isEvalGraph) {
        lines.push("classDef ok fill:#2ecc71,stroke:#0e8046,stroke-width:2px")
        lines.push("classDef violation fill:#ff4136,stroke:#ad0e05,stroke-width:2px")
        lines.push("classDef missing fill:#d9d9d9,stroke:#6e6e6e,stroke-width:2px")
    }
    return lines.join("\n")
}

export class EvalGraph {
    constructor(ruleGraph, individuals) {
        this.isEvalGraph = true
        this.uri = ruleGraph.uri
        this.rootNodes = {}
        this.containsPointersToTheseShapes = ruleGraph.containsPointersToTheseShapes
        for (let [indiv, cls] of Object.entries(individuals)) {
            let clonedRootNode = structuredClone(ruleGraph.rootNodes[cls])
            clonedRootNode.individualUri = indiv
            this.rootNodes[indiv] = clonedRootNode
        }
        this.ruleGraph = cleanGraph(ruleGraph)
        this.validationReportTurtle = null
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
            let children = node.children || []
            let minCount1ChildIsOk = children.some(child => child.rule && child.rule.type === "sh:minCount" && child.rule.value.toString() === "1" && child.eval.status === OK)
            children = children.filter(child => !(child.rule && child.rule.type === "sh:minCount" && child.rule.value.toString() === "1"))
            let hasChildren = children.length > 0
            switch(node.type) {
                case TYPE.ROOT:
                case TYPE.DATAFIELD:
                case TYPE.AND:
                    node.eval = { status: hasChildren || minCount1ChildIsOk ? OK : MISSING }
                    for (const child of children) node.eval.status = andStatus(node.eval.status, recursiveEval(child))
                    break;
                case TYPE.OR:
                    node.eval = { status: hasChildren ? VIOLATION : MISSING }
                    for (const child of children) node.eval.status = orStatus(node.eval.status, recursiveEval(child))
                    break
                case TYPE.NOT:
                    // do the same as AND, but then invert
                    node.eval = { status: hasChildren ? OK : MISSING }
                    for (const child of children) node.eval.status = andStatus(node.eval.status, recursiveEval(child))
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
}
