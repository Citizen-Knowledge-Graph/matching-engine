import "./fixtures/common.js"
import { describe } from "mocha"
import { expand } from "@foerderfunke/sem-ops-utils"

describe("rule graph", function () {
    let matchingEngine

    before(function () {
        matchingEngine = globalThis.matchingEngine
    })

    it("rule graph should be correct",async function () {
        let shacl = `
            @prefix sh: <http://www.w3.org/ns/shacl#> .
            @prefix ff: <https://foerderfunke.org/default#> .

            ff:ruleGraphDev a ff:RequirementProfile .
            ff:devShape a sh:NodeShape ;
            sh:targetClass ff:Citizen ;
            
            sh:property [ sh:not [ sh:path ff:foo ; sh:minInclusive 15 ; sh:maxExclusive 36  ] ] ;
            sh:property [ sh:path ff:bar ; sh:not [ sh:in (ff:blau ff:red) ] ] ;
            sh:property [
                sh:or (
                    [ sh:and (
                        [ sh:property [ sh:path ff:dings ; sh:in (true) ] ]
                        [ sh:property [ sh:path ff:hey ; sh:in (true) ] ]
                    ) ]
                    [ sh:property [ sh:path ff:jo ; sh:in (false) ] ]
                )
            ] .`
        await matchingEngine.buildRuleGraph(shacl)

        let up = `
            @prefix ff: <https://foerderfunke.org/default#> .
            ff:mainPerson a ff:Citizen ;
                ff:foo 7 ;
                ff:bar ff:green ;
                ff:dings true ;
                ff:hey true ;
                ff:jo true .`

        matchingEngine.addValidator(shacl)
        matchingEngine.init()

        await matchingEngine.detailedSingleRequirementProfileValidation(up, expand("ff:ruleGraphDev"))
    })
})
