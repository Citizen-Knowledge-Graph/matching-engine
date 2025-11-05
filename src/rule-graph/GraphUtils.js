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

    const formatValue = (val) => {
        if (val === undefined || val === null) return null
        if (typeof val === "string") {
            const lbl = datafieldToLabel(val, matchingEngine, lang)
            return lbl || val
        }
        return String(val)
    }

    const descend = (node, parent) => {
        if (node.type === TYPE.RULE && node.eval.status === STATUS.VIOLATION) {
            const datafield = parent ? parent.path : ""
            const label = datafieldToLabel(datafield, matchingEngine, lang)
            let str = ""

            // 0) range merge detection
            if (
                parent &&
                parent.children &&
                ["sh:minInclusive", "sh:minExclusive", "sh:maxInclusive", "sh:maxExclusive"].includes(node.rule.type)
            ) {
                const siblings = parent.children.filter(
                    c => c.type === TYPE.RULE && c.eval?.status === STATUS.VIOLATION
                )

                const minRule = siblings.find(c =>
                    c.rule && (c.rule.type === "sh:minInclusive" || c.rule.type === "sh:minExclusive")
                )
                const maxRule = siblings.find(c =>
                    c.rule && (c.rule.type === "sh:maxInclusive" || c.rule.type === "sh:maxExclusive")
                )

                // if we're on the MIN rule and both have the SAME actual value -> emit combined and return
                if (
                    minRule &&
                    maxRule &&
                    node === minRule &&
                    minRule.eval.value !== undefined &&
                    maxRule.eval.value !== undefined &&
                    minRule.eval.value === maxRule.eval.value
                ) {
                    const minVal = formatValue(minRule.rule.value)
                    const maxVal = formatValue(maxRule.rule.value)
                    const actualVal = formatValue(minRule.eval.value)

                    if (lang === "de") {
                        if (actualVal) {
                            str = `<strong>${label}</strong> muss zwischen <strong>${minVal}</strong> und <strong>${maxVal}</strong> liegen, angegeben ist <strong>${actualVal}</strong>.`
                        } else {
                            str = `<strong>${label}</strong> muss zwischen <strong>${minVal}</strong> und <strong>${maxVal}</strong> liegen, ein Wert ist jedoch nicht angegeben.`
                        }
                    } else {
                        if (actualVal) {
                            str = `<strong>${label}</strong> must be between <strong>${minVal}</strong> and <strong>${maxVal}</strong>, but it is <strong>${actualVal}</strong>.`
                        } else {
                            str = `<strong>${label}</strong> must be between <strong>${minVal}</strong> and <strong>${maxVal}</strong>, but no value is given.`
                        }
                    }

                    violations.push(str)
                    return
                }

                // if we're on the MAX rule and there is a matching MIN with same actual -> skip,
                // because the min branch already emitted the combined message
                if (
                    minRule &&
                    maxRule &&
                    node === maxRule &&
                    minRule.eval.value !== undefined &&
                    maxRule.eval.value !== undefined &&
                    minRule.eval.value === maxRule.eval.value
                ) {
                    return
                }
            }

            // 1) sh:in
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

                // 2) sh:hasValue
            } else if (node.rule.type === "sh:hasValue") {
                const expected = formatValue(node.rule.value)
                const actual = formatValue(node.eval.value)

                if (lang === "de") {
                    if (actual) {
                        str = `<strong>${label}</strong> ist mit <strong>${actual}</strong> angegeben, erwartet wird jedoch <strong>${expected}</strong>.`
                    } else {
                        str = `Für <strong>${label}</strong> wird <strong>${expected}</strong> erwartet, ein Wert ist jedoch nicht angegeben.`
                    }
                } else {
                    if (actual) {
                        str = `<strong>${label}</strong> is given as <strong>${actual}</strong>, but <strong>${expected}</strong> is required.`
                    } else {
                        str = `A value of <strong>${expected}</strong> is required for <strong>${label}</strong>, but none is given.`
                    }
                }

                // 3) numeric constraints (single)
            } else if (
                node.rule.type === "sh:maxInclusive" ||
                node.rule.type === "sh:minInclusive" ||
                node.rule.type === "sh:maxExclusive" ||
                node.rule.type === "sh:minExclusive"
            ) {
                const expected = formatValue(node.rule.value)
                const actual = formatValue(node.eval.value)

                if (lang === "de") {
                    if (node.rule.type === "sh:maxInclusive") {
                        if (actual) {
                            str = `<strong>${label}</strong> darf höchstens <strong>${expected}</strong> sein, angegeben ist <strong>${actual}</strong>.`
                        } else {
                            str = `<strong>${label}</strong> darf höchstens <strong>${expected}</strong> sein, ein Wert ist jedoch nicht angegeben.`
                        }
                    } else if (node.rule.type === "sh:minInclusive") {
                        if (actual) {
                            str = `<strong>${label}</strong> muss mindestens <strong>${expected}</strong> sein, angegeben ist <strong>${actual}</strong>.`
                        } else {
                            str = `<strong>${label}</strong> muss mindestens <strong>${expected}</strong> sein, ein Wert ist jedoch nicht angegeben.`
                        }
                    } else if (node.rule.type === "sh:maxExclusive") {
                        if (actual) {
                            str = `<strong>${label}</strong> muss kleiner als <strong>${expected}</strong> sein, angegeben ist <strong>${actual}</strong>.`
                        } else {
                            str = `<strong>${label}</strong> muss kleiner als <strong>${expected}</strong> sein, ein Wert ist jedoch nicht angegeben.`
                        }
                    } else if (node.rule.type === "sh:minExclusive") {
                        if (actual) {
                            str = `<strong>${label}</strong> muss größer als <strong>${expected}</strong> sein, angegeben ist <strong>${actual}</strong>.`
                        } else {
                            str = `<strong>${label}</strong> muss größer als <strong>${expected}</strong> sein, ein Wert ist jedoch nicht angegeben.`
                        }
                    }
                } else {
                    if (node.rule.type === "sh:maxInclusive") {
                        if (actual) {
                            str = `<strong>${label}</strong> must be at most <strong>${expected}</strong>, but it is <strong>${actual}</strong>.`
                        } else {
                            str = `<strong>${label}</strong> must be at most <strong>${expected}</strong>, but no value is given.`
                        }
                    } else if (node.rule.type === "sh:minInclusive") {
                        if (actual) {
                            str = `<strong>${label}</strong> must be at least <strong>${expected}</strong>, but it is <strong>${actual}</strong>.`
                        } else {
                            str = `<strong>${label}</strong> must be at least <strong>${expected}</strong>, but no value is given.`
                        }
                    } else if (node.rule.type === "sh:maxExclusive") {
                        if (actual) {
                            str = `<strong>${label}</strong> must be less than <strong>${expected}</strong>, but it is <strong>${actual}</strong>.`
                        } else {
                            str = `<strong>${label}</strong> must be less than <strong>${expected}</strong>, but no value is given.`
                        }
                    } else if (node.rule.type === "sh:minExclusive") {
                        if (actual) {
                            str = `<strong>${label}</strong> must be greater than <strong>${expected}</strong>, but it is <strong>${actual}</strong>.`
                        } else {
                            str = `<strong>${label}</strong> must be greater than <strong>${expected}</strong>, but no value is given.`
                        }
                    }
                }

                // 4) fallback
            } else {
                str = `${print("theValueOf", lang)} <strong>${label}</strong> `
                str += `${print(node.rule.type, lang, false)} ${node.rule.value}`
                if (node.eval.value) {
                    const actual = formatValue(node.eval.value)
                    str += `, ${print("actualValueKnown", lang, false)} <strong>${actual}</strong>.`
                } else {
                    str += `, ${print("actualValueUnknown", lang)}.`
                }
            }

            violations.push(str)
        }

        if (node.children && node.eval.status === STATUS.VIOLATION) {
            for (const child of node.children) {
                descend(child, node)
            }
        }
    }

    for (const rootNode of Object.values(evalGraph.rootNodes || {})) {
        descend(rootNode, null)
    }

    return violations
}