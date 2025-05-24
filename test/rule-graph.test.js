import "./fixtures/common.js"
import { describe } from "mocha"

describe("rule graph", function () {
    let matchingEngine

    before(function () {
        matchingEngine = globalThis.matchingEngine
        matchingEngine.init()
    })

    it("rule graph should be correct",async function () {
        let shacl = `
            @prefix sh: <http://www.w3.org/ns/shacl#> .
            @prefix ff: <https://foerderfunke.org/default#> .

            ff:devShape a sh:NodeShape ;
            sh:targetClass ff:Citizen ;
            
            sh:property [ sh:not [ sh:path ff:foo ; sh:minInclusive 15 ; sh:maxExclusive 36 ] ] ;
            sh:property [ sh:path ff:bar ; sh:in (ff:blau ff:red) ] ;
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
    })
})
