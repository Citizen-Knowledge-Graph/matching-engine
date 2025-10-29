import { TYPE } from "./RuleGraph.js"
import { datafieldToLabel, print, STATUS } from "./EvalGraph.js"

// move cleanGraph and graphToMermaid here TODO

// strategy: descend from root into red nodes, not recursively through all
export const violationsToText = (evalGraph, matchingEngine) => {
    let violations = []
    let lang = matchingEngine.lang || "en"
    const descend = (node, parent) => {
        if (node.type === TYPE.RULE && node.eval.status === STATUS.VIOLATION) {
            let datafield = parent.path
            let str = `The value of "${datafieldToLabel(datafield, matchingEngine, lang)}" `
            if (node.rule.type === "sh:in") { // reuse same method as in graphToMermaid for deduplicating code?
                if (node.rule.values.length <= 1) {
                    str += `${print("shInOne", lang, false)} "${datafieldToLabel(node.rule.values[0], matchingEngine, lang)}"`
                } else {
                    str += `${print("shInMultiple", lang, false)} "${node.rule.values.map(val => datafieldToLabel(val, matchingEngine, lang)).join(", ")}"`
                }
            } else {
                str += `${print(node.rule.type, lang, false)} ${node.rule.value}`
            }
            if (node.eval.value) {
                str += ` ${print("actualValueKnown", lang, false)} "${datafieldToLabel(node.eval.value, matchingEngine, lang)}".`
            } else {
                str += ` ${print("actualValueUnknown", lang)}.`
            }
            violations.push(str)
        }
        if (node.children && node.eval.status === STATUS.VIOLATION) {
            for (let child of node.children) descend(child, node)
        }
    }
    for (let rootNode of Object.values(evalGraph.rootNodes || {})) descend(rootNode, null)
    return violations
}
