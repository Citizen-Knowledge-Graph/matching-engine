import "./fixtures/common.js"
import { describe, it, before } from "mocha"
import { expand } from "@foerderfunke/sem-ops-utils"
import { addRpsFromKnowledgeBase } from "./fixtures/common.js"
import { violationsToText } from "../src/rule-graph/GraphUtils.js"
import { TYPE } from "../src/rule-graph/RuleGraph.js"
import { STATUS } from "../src/rule-graph/EvalGraph.js"

describe("rule graph utils", function () {
    this.timeout(10000)

    let matchingEngine

    before(async function () {
        matchingEngine = globalThis.matchingEngine
        // load at least one RP so matchingEngine is initialized and has its stores
        await addRpsFromKnowledgeBase([expand("ff:wolfenbuettel-stiftung-organisation")])
        await matchingEngine.init()
    })

    it("should render correct violation strings for ff:wolfenbuettel-stiftung-organisation", async function () {
        matchingEngine.lang = "en"
        const up = `
            @prefix ff: <https://foerderfunke.org/default#> .
            ff:mainPerson a ff:Citizen ;
                ff:associationHeadquarters ff:associationHeadquarters-other ;
                ff:associationActivity ff:associationActivity-social .
        `
        const evalGraph = await matchingEngine.buildEvaluationGraph(
            up,
            expand("ff:wolfenbuettel-stiftung-organisation")
        )
        const texts = violationsToText(evalGraph, matchingEngine)
        console.log(texts)
    })

    // 1) DE, multi-value, actual given -> „… ist mit … angegeben, erwartet wird jedoch einer der Werte: …“
    it("should render DE multi-value violation for gender with actual value", function () {
        matchingEngine.lang = "de"

        const evalGraph = {
            rootNodes: {
                gender: {
                    // parent node for datafield
                    path: "ff:gender",
                    eval: { status: STATUS.VIOLATION },
                    children: [
                        {
                            type: TYPE.RULE,
                            rule: {
                                type: "sh:in",
                                values: [
                                    "ff:gender-male",
                                    "ff:gender-female",
                                    "ff:gender-diverse",
                                    "ff:gender-other",
                                ],
                            },
                            eval: {
                                status: STATUS.VIOLATION,
                                // user chose something invalid, pretend it's "ff:gender-wrong"
                                value: "ff:gender-wrong",
                            },
                        },
                    ],
                },
            },
        }

        const texts = violationsToText(evalGraph, matchingEngine)
        console.log(texts)
    })

    // 2) DE, multi-value, no actual -> „Für … wird einer der folgenden Werte erwartet: …, ein Wert ist jedoch nicht angegeben.“
    it("should render DE multi-value violation for citizenship with no actual", function () {
        matchingEngine.lang = "de"

        const evalGraph = {
            rootNodes: {
                citizenship: {
                    path: "ff:citizenship",
                    eval: { status: STATUS.VIOLATION },
                    children: [
                        {
                            type: TYPE.RULE,
                            rule: {
                                type: "sh:in",
                                values: [
                                    "ff:citizenship-ger",
                                    "ff:citizenship-eu",
                                    "ff:citizenship-3rd",
                                ],
                            },
                            eval: {
                                status: STATUS.VIOLATION,
                                // no value given
                            },
                        },
                    ],
                },
            },
        }

        const texts = violationsToText(evalGraph, matchingEngine)
        console.log(texts)
    })

    // 3) EN, multi-value, actual given -> “... is given as “…”, but one of the following is required: …”
    it("should render EN multi-value violation for residencyStatus with actual value", function () {
        matchingEngine.lang = "en"

        const evalGraph = {
            rootNodes: {
                residencyStatus: {
                    path: "ff:residencyStatus",
                    eval: { status: STATUS.VIOLATION },
                    children: [
                        {
                            type: TYPE.RULE,
                            rule: {
                                type: "sh:in",
                                values: [
                                    "ff:residencyStatus-ger",
                                    "ff:residencyStatus-asylum",
                                    "ff:residencyStatus-toleration",
                                    "ff:residencyStatus-residencePermit",
                                    "ff:residencyStatus-settlementPermit",
                                    "ff:residencyStatus-other",
                                ],
                            },
                            eval: {
                                status: STATUS.VIOLATION,
                                value: "ff:residencyStatus-unknown",
                            },
                        },
                    ],
                },
            },
        }

        const texts = violationsToText(evalGraph, matchingEngine)
        console.log(texts)
    })

    // 4) EN, multi-value, no actual -> “One of the following is required for …, but no value is given.”
    it("should render EN multi-value violation for hasResidence with no actual", function () {
        matchingEngine.lang = "en"

        const evalGraph = {
            rootNodes: {
                hasResidence: {
                    path: "ff:hasResidence",
                    eval: { status: STATUS.VIOLATION },
                    children: [
                        {
                            type: TYPE.RULE,
                            rule: {
                                type: "sh:in",
                                values: [
                                    "ff:hasResidence-muenchen",
                                    "ff:hasResidence-hamburg",
                                    "ff:hasResidence-frankfurt",
                                    "ff:hasResidence-koeln",
                                    "ff:hasResidence-berlin",
                                    "ff:hasResidence-wolfenbuettel",
                                    "ff:hasResidence-bielefeld",
                                    "ff:hasResidence-other",
                                ],
                            },
                            eval: {
                                status: STATUS.VIOLATION,
                                // no value
                            },
                        },
                    ],
                },
            },
        }

        const texts = violationsToText(evalGraph, matchingEngine)
        console.log(texts)
    })

    it("should render DE multi-value violation for gender with wrong answer", function () {
        matchingEngine.lang = "de"
    
        const evalGraph = {
            rootNodes: {
                gender: {
                    path: "ff:gender",
                    eval: { status: STATUS.VIOLATION },
                    children: [
                        {
                            type: TYPE.RULE,
                            rule: {
                                type: "sh:in",
                                values: [
                                    "ff:gender-male",
                                    "ff:gender-female",
                                    "ff:gender-diverse"
                                ],
                            },
                            eval: {
                                status: STATUS.VIOLATION,
                                value: "ff:gender-other", // invalid value
                            },
                        },
                    ],
                },
            },
        }
    
        const texts = violationsToText(evalGraph, matchingEngine)
        console.log(texts)
        // expected output (approx):
        // „Geschlecht“ ist mit „Unbekannt“ angegeben, erwartet wird jedoch einer der Werte: Männlich oder Weiblich oder Divers oder Anderes.
    })
})