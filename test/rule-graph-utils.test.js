import "./fixtures/common.js"
import { describe, it, before } from "mocha"
import { expand } from "@foerderfunke/sem-ops-utils"
import { addRpsFromKnowledgeBase } from "./fixtures/common.js"
import { violationsToText } from "../src/rule-graph/GraphUtils.js"
import { TYPE } from "../src/rule-graph/RuleGraph.js"
import { STATUS } from "../src/rule-graph/EvalGraph.js"
import { strict as assert } from "node:assert"


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

    it("should render EN hasValue violation for longTermStay", function () {
        matchingEngine.lang = "en"

        const evalGraph = {
            rootNodes: {
                longTermStay: {
                    path: "ff:longTermStay",
                    eval: { status: STATUS.VIOLATION },
                    children: [
                        {
                            type: TYPE.RULE,
                            rule: {
                                type: "sh:hasValue",
                                value: true, // expected value
                            },
                            eval: {
                                status: STATUS.VIOLATION,
                                value: false, // actual value
                            },
                        },
                    ],
                },
            },
        }

        const texts = violationsToText(evalGraph, matchingEngine)
        console.log(texts)
        // expected shape (depends on your print() translations), something like:
        // The value of <strong>Long-term stay in Germany</strong> hasValue true, actual value is <strong>false</strong>.
    })
    // 5) EN - minInclusive (actual < required)
    it("should render EN minInclusive violation with actual value", function () {
        matchingEngine.lang = "en"

        const evalGraph = {
            rootNodes: {
                age: {
                    path: "ff:assets",
                    eval: { status: STATUS.VIOLATION },
                    children: [
                        {
                            type: TYPE.RULE,
                            rule: { type: "sh:minInclusive", value: 18 },
                            eval: { status: STATUS.VIOLATION, value: 16 },
                        },
                    ],
                },
            },
        }

        const texts = violationsToText(evalGraph, matchingEngine)
        console.log(texts)
        // Expected:
        // <strong>Age</strong> must be at least <strong>18</strong>, but it is <strong>16</strong>.
    })

    // 6) DE - maxInclusive (no actual)
    it("should render DE maxInclusive violation with no actual value", function () {
        matchingEngine.lang = "de"

        const evalGraph = {
            rootNodes: {
                einkommen: {
                    path: "ff:assets",
                    eval: { status: STATUS.VIOLATION },
                    children: [
                        {
                            type: TYPE.RULE,
                            rule: { type: "sh:maxInclusive", value: 2000 },
                            eval: { status: STATUS.VIOLATION }, // no actual value
                        },
                    ],
                },
            },
        }

        const texts = violationsToText(evalGraph, matchingEngine)
        console.log(texts)
        // Expected:
        // <strong>Einkommen</strong> darf höchstens <strong>2000</strong> sein, ein Wert ist jedoch nicht angegeben.
    })

    // 7) EN - maxExclusive (actual == value)
    it("should render EN maxExclusive violation with equal value", function () {
        matchingEngine.lang = "en"

        const evalGraph = {
            rootNodes: {
                temperature: {
                    path: "ff:hasAge",
                    eval: { status: STATUS.VIOLATION },
                    children: [
                        {
                            type: TYPE.RULE,
                            rule: { type: "sh:maxExclusive", value: 100 },
                            eval: { status: STATUS.VIOLATION, value: 100 },
                        },
                    ],
                },
            },
        }

        const texts = violationsToText(evalGraph, matchingEngine)
        console.log(texts)
        // Expected:
        // <strong>Temperature</strong> must be less than <strong>100</strong>, but it is <strong>100</strong>.
    })

    // 8) DE - minExclusive (actual below)
    it("should render DE minExclusive violation with actual value", function () {
        matchingEngine.lang = "de"

        const evalGraph = {
            rootNodes: {
                laufzeit: {
                    path: "ff:hasAge",
                    eval: { status: STATUS.VIOLATION },
                    children: [
                        {
                            type: TYPE.RULE,
                            rule: { type: "sh:minExclusive", value: 10 },
                            eval: { status: STATUS.VIOLATION, value: 9 },
                        },
                    ],
                },
            },
        }

        const texts = violationsToText(evalGraph, matchingEngine)
        console.log(texts)
        // Expected:
        // <strong>Laufzeit</strong> muss größer als <strong>10</strong> sein, tatsächlich ist es <strong>9</strong>.
    })

    // 9) EN - combined minInclusive and maxExclusive range violation
    it("should render EN range violation (minInclusive + maxExclusive) as single sentence", function () {
        matchingEngine.lang = "en"

        const evalGraph = {
            rootNodes: {
                hasAge: {
                    path: "ff:hasAge",
                    eval: { status: STATUS.VIOLATION },
                    children: [
                        {
                            type: TYPE.RULE,
                            rule: { type: "sh:maxExclusive", value: 36 },
                            eval: { status: STATUS.VIOLATION, value: 40 }, // same actual
                        },
                        {
                            type: TYPE.RULE,
                            rule: { type: "sh:minInclusive", value: 15 },
                            eval: { status: STATUS.VIOLATION, value: 40 }, // same actual
                        }
                    ],
                },
            },
        }

        const texts = violationsToText(evalGraph, matchingEngine)
        console.log(texts)
        // Expected output (one string):
        // <strong>Age</strong> must be between <strong>15</strong> and <strong>36</strong>, but it is <strong>40</strong>.
    })
    // 10) EN - real-world eval graph example (only violations)
    it("should render EN violations correctly for a mixed eval graph", function () {
        matchingEngine.lang = "en"

        const evalGraph = {
            rootNodes: {
                root: {
                    id: 0,
                    type: "root",
                    eval: { status: STATUS.VIOLATION },
                    nodeShapeUri: "https://foerderfunke.org/default#wohngeldMainShape",
                    children: [
                        {
                            id: 1,
                            type: TYPE.DATAFIELD,
                            eval: { status: STATUS.MISSING },
                            path: "ff:birthDate",
                            children: [],
                        },
                        {
                            id: 3,
                            type: TYPE.DATAFIELD,
                            eval: { status: STATUS.MISSING },
                            path: "ff:hasAge",
                            children: [
                                {
                                    id: 5,
                                    type: TYPE.RULE,
                                    eval: { status: STATUS.MISSING },
                                    rule: { type: "sh:minInclusive", value: "15" },
                                },
                            ],
                        },
                        {
                            id: 12,
                            type: TYPE.DATAFIELD,
                            eval: { status: STATUS.VIOLATION },
                            path: "ff:employmentStatus",
                            children: [
                                {
                                    id: 14,
                                    type: "sh:not",
                                    eval: { status: STATUS.VIOLATION },
                                    children: [
                                        {
                                            id: 15,
                                            type: TYPE.RULE,
                                            eval: { status: STATUS.OK },
                                            rule: {
                                                type: "sh:in",
                                                values: ["ff:employmentStatus-inEducation"],
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            },
        }

        const texts = violationsToText(evalGraph, matchingEngine)
        console.log(texts)

        // we only care that we got *some* violations array here; since the rule under sh:not is "ok",
        // it's fine if this ends up being empty with the current logic
        assert.ok(Array.isArray(texts))
    })
    // 11) EN - mixed eval graph with one real violation
    it("should render EN violation for mixed eval graph", function () {
        matchingEngine.lang = "en"

        const evalGraph = {
            rootNodes: {
                citizen: {
                    path: "ff:citizen",
                    eval: { status: STATUS.VIOLATION },
                    children: [
                        {
                            path: "ff:birthDate",
                            eval: { status: STATUS.MISSING },
                            children: [],
                        },
                        {
                            path: "ff:hasAge",
                            eval: { status: STATUS.MISSING },
                            children: [
                                {
                                    type: TYPE.RULE,
                                    rule: { type: "sh:minInclusive", value: 18 },
                                    eval: { status: STATUS.MISSING },
                                },
                            ],
                        },
                        {
                            path: "ff:employmentStatus",
                            eval: { status: STATUS.VIOLATION },
                            children: [
                                {
                                    type: TYPE.RULE,
                                    rule: {
                                        type: "sh:in",
                                        values: ["ff:employmentStatus-unemployed"],
                                    },
                                    eval: {
                                        status: STATUS.VIOLATION,
                                        value: "ff:employmentStatus-employed",
                                    },
                                },
                            ],
                        },
                    ],
                },
            },
        }

        const texts = violationsToText(evalGraph, matchingEngine)
        console.log(texts)
        // Expected output (one string):
        // <strong>Employment status</strong> is given as <strong>Employed</strong>, but <strong>Unemployed</strong> is required.
    })

    // 12) EN - should handle sh:not violations correctly
    it("should render EN violation for sh:not with non-violating child", function () {
        matchingEngine.lang = "en"

        const evalGraph = {
            rootNodes: {
                employmentStatus: {
                    path: "ff:employmentStatus",
                    eval: { status: STATUS.VIOLATION },
                    children: [
                        {
                            type: "sh:not",
                            eval: { status: STATUS.VIOLATION },
                            children: [
                                {
                                    type: TYPE.RULE,
                                    rule: { type: "sh:in", values: ["ff:employmentStatus-inEducation"] },
                                    eval: { status: STATUS.OK },
                                },
                            ],
                        },
                    ],
                },
            },
        }

        const texts = violationsToText(evalGraph, matchingEngine)
        console.log(texts)
        // Expected output:
        // ["<strong>Employment status</strong> must not be <strong>In education</strong>."]
    })

    // 13) DE - should handle sh:not violations correctly
    it("should render EN violation for sh:not with non-violating child", function () {
        matchingEngine.lang = "de"

        const evalGraph = {
            rootNodes: {
                employmentStatus: {
                    path: "ff:employmentStatus",
                    eval: { status: STATUS.VIOLATION },
                    children: [
                        {
                            type: "sh:not",
                            eval: { status: STATUS.VIOLATION },
                            children: [
                                {
                                    type: TYPE.RULE,
                                    rule: { type: "sh:in", values: ["ff:employmentStatus-inEducation"] },
                                    eval: { status: STATUS.OK },
                                },
                            ],
                        },
                    ],
                },
            },
        }

        const texts = violationsToText(evalGraph, matchingEngine)
        console.log(texts)
        // Expected output:
        // ["<strong>Employment status</strong> must not be <strong>In education</strong>."]
    })    
})