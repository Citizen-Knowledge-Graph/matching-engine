import "./fixtures/common.js"
import { describe } from "mocha"

describe("rule graph", function () {
    let matchingEngine

    before(function () {
        matchingEngine = globalThis.matchingEngine
        matchingEngine.init()
    })

    it("simple rule graph should be correct",function () {
        let shacl = `
            @prefix sh: <http://www.w3.org/ns/shacl#> .
            @prefix ff: <https://foerderfunke.org/default#> .

            ff:devShape a sh:NodeShape ;
            sh:targetClass ff:Citizen ;
            
            sh:property [ sh:path ff:foo ; sh:in (true) ] ;
            sh:property [ sh:path ff:bar ; sh:in (ff:blau) ] ;
            sh:property [
              sh:or (
                [ sh:property [ sh:path ff:dings ; sh:in (true) ] ]
                [ sh:property [ sh:path ff:jo ; sh:in (false) ] ]
              )
            ] .`
        matchingEngine.buildRuleGraph(shacl)
    })
})
