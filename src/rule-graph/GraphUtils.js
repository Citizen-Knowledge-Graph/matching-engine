import { TYPE } from "./RuleGraph.js"
import { datafieldToLabel, print, STATUS } from "./EvalGraph.js"

export const violationsToText = (evalGraph, matchingEngine) => {
    let violations = []
    let lang = matchingEngine.lang || "en"

    const joinList = (labels, lang) => {
        if (labels.length === 1) return labels[0]
        if (labels.length === 2)
            return lang === "de"
                ? `${labels[0]} oder ${labels[1]}`
                : `${labels[0]} or ${labels[1]}`
        const sep = lang === "de" ? " oder " : ", "
        return `${labels.slice(0, -1).join(", ")}${sep}${labels[labels.length - 1]}`
    }

    const descend = (node, parent) => {
        if (node.type === TYPE.RULE && node.eval.status === STATUS.VIOLATION) {
            let datafield = parent ? parent.path : ""
            let label = datafieldToLabel(datafield, matchingEngine, lang)
            let str = ""

            if (node.rule.type === "sh:in") {
                const expectedLabels = node.rule.values.map(val =>
                    datafieldToLabel(val, matchingEngine, lang)
                )
                const actualLabel = node.eval.value
                    ? datafieldToLabel(node.eval.value, matchingEngine, lang)
                    : null

                if (lang === "de") {
                    if (expectedLabels.length === 1) {
                        const expected = expectedLabels[0]
                        if (actualLabel) {
                            str = `„${label}“ ist mit „${actualLabel}“ angegeben, erwartet wird jedoch „${expected}“.`
                        } else {
                            str = `Für „${label}“ wird „${expected}“ erwartet, ein Wert ist jedoch nicht angegeben.`
                        }
                    } else {
                        const expectedJoined = joinList(expectedLabels, lang)
                        if (actualLabel) {
                            str = `„${label}“ ist mit „${actualLabel}“ angegeben, erwartet wird jedoch einer der Werte: ${expectedJoined}.`
                        } else {
                            str = `Für „${label}“ wird einer der folgenden Werte erwartet: ${expectedJoined}, ein Wert ist jedoch nicht angegeben.`
                        }
                    }
                } else {
                    if (expectedLabels.length === 1) {
                        const expected = expectedLabels[0]
                        if (actualLabel) {
                            str = `“${label}” is given as “${actualLabel}”, but “${expected}” is required.`
                        } else {
                            str = `A value of “${expected}” is required for “${label}”, but none is given.`
                        }
                    } else {
                        const expectedJoined = joinList(expectedLabels, lang)
                        if (actualLabel) {
                            str = `“${label}” is given as “${actualLabel}”, but one of the following is required: ${expectedJoined}.`
                        } else {
                            str = `One of the following is required for “${label}”: ${expectedJoined}, but no value is given.`
                        }
                    }
                }
            } else {
                str = `${print("theValueOf", lang)} "${label}" `
                str += `${print(node.rule.type, lang, false)} ${node.rule.value}`
                if (node.eval.value) {
                    str += `, ${print("actualValueKnown", lang, false)} "${datafieldToLabel(node.eval.value, matchingEngine, lang)}".`
                } else {
                    str += `, ${print("actualValueUnknown", lang)}.`
                }
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