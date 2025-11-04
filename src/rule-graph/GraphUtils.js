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
            const datafield = parent ? parent.path : ""
            const label = datafieldToLabel(datafield, matchingEngine, lang)
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
                            str = `<strong>${label}</strong> ist mit <strong>${actualLabel}</strong> angegeben, erwartet wird jedoch <strong>${expected}</strong>.`
                        } else {
                            str = `Für <strong>${label}</strong> wird <strong>${expected}</strong> erwartet, ein Wert ist jedoch nicht angegeben.`
                        }
                    } else {
                        const expectedJoined = joinList(expectedLabels, lang)
                        if (actualLabel) {
                            str = `<strong>${label}</strong> ist mit <strong>${actualLabel}</strong> angegeben, erwartet wird jedoch einer der Werte: <strong>${expectedJoined}</strong>.`
                        } else {
                            str = `Für <strong>${label}</strong> wird einer der folgenden Werte erwartet: <strong>${expectedJoined}</strong>, ein Wert ist jedoch nicht angegeben.`
                        }
                    }
                } else {
                    if (expectedLabels.length === 1) {
                        const expected = expectedLabels[0]
                        if (actualLabel) {
                            str = `<strong>${label}</strong> is given as <strong>${actualLabel}</strong>, but <strong>${expected}</strong> is required.`
                        } else {
                            str = `A value of <strong>${expected}</strong> is required for <strong>${label}</strong>, but none is given.`
                        }
                    } else {
                        const expectedJoined = joinList(expectedLabels, lang)
                        if (actualLabel) {
                            str = `<strong>${label}</strong> is given as <strong>${actualLabel}</strong>, but one of the following is required: <strong>${expectedJoined}</strong>.`
                        } else {
                            str = `One of the following is required for <strong>${label}</strong>: <strong>${expectedJoined}</strong>, but no value is given.`
                        }
                    }
                }
            } else {
                // fallback for non-sh:in rules, keep style consistent
                str = `${print("theValueOf", lang)} <strong>${label}</strong> `
                str += `${print(node.rule.type, lang, false)} ${node.rule.value}`
                if (node.eval.value) {
                    str += `, ${print("actualValueKnown", lang, false)} <strong>${datafieldToLabel(node.eval.value, matchingEngine, lang)}</strong>.`
                } else {
                    str += `, ${print("actualValueUnknown", lang)}.`
                }
            }

            violations.push(str)
        }

        if (node.children && node.eval.status === STATUS.VIOLATION) {
            for (const child of node.children) descend(child, node)
        }
    }

    for (const rootNode of Object.values(evalGraph.rootNodes || {})) {
        descend(rootNode, null)
    }

    return violations
}