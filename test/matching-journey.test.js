import { describe } from "mocha"
import { expand, isomorphicTurtles, shrink, sparqlInsertDelete, sparqlSelect, storeFromTurtles, storeToTurtle } from "@foerderfunke/sem-ops-utils"
import { FORMAT, MATCHING_MODE } from "../src/queries.js"
import { strictEqual } from "node:assert"
import { addRpsFromKnowledgeBase } from "./fixtures/common.js"

describe("testing matching functionality via journey calls", function () {
    // this.timeout(10000)
    let matchingEngine
    let familienleistungenRpUris = [
        expand("ff:hilfe-zum-lebensunterhalt"),
        expand("ff:kindergeld"),
        expand("ff:kinderzuschlag"),
        expand("ff:buergergeld"),
        expand("ff:bildung-und-teilhabe-bei-bezug-von-buergergeld")
    ]

    before(async function () {
        matchingEngine = globalThis.matchingEngine
        let shacl = `
            @prefix sh: <http://www.w3.org/ns/shacl#> .
            @prefix ff: <https://foerderfunke.org/default#> .
            @prefix shn: <https://schemas.link/shacl-next#>.
            
            ff:uebergangsgeld-behinderung a ff:RequirementProfile ;
                ff:hasEvalShape ff:uebergangsgeldEvalShape ;
                ff:hasFlowShape ff:uebergangsgeldFlowShape .
            
            # ----- EVALUATION LOGIC -----
            
            ff:uebergangsgeldEvalShape a sh:NodeShape ;
                sh:targetClass ff:Citizen ;

                sh:property [ sh:path ff:has_disability ; sh:in (true) ] ;
                sh:property [ sh:path ff:rehabilitation_provider ; sh:in (ff:rehabilitation_provider-bundesagentur-fuer-arbeit) ] ;
                sh:property [
                    sh:or (
                        [ sh:property [ sh:path ff:berufsausbildungsabschluss ; sh:in (true) ] ]
                        [ 
                            sh:property [ sh:path ff:berufsausbildungsabschluss ; sh:in (false) ] ;
                            sh:or (
                                [ 
                                    sh:property [ sh:path ff:berufsrueckkehrer ; sh:in (false) ] ;
                                    sh:or (
                                        [ sh:property [ sh:path ff:sozialversichert12in3 ; sh:in (true) ] ]
                                        [ sh:property [ sh:path ff:anspruchAlgIn3 ; sh:in (true) ] ]
                                        [ sh:property [ sh:path ff:anspruchSoldatenIn3 ; sh:in (true) ] ]
                                    )
                                ]
                                [ 
                                    sh:property [ sh:path ff:berufsrueckkehrer ; sh:in (true) ] ;
                                    sh:or (
                                        [ sh:property [ sh:path ff:sozialversichert12 ; sh:in (true) ] ]
                                        [ sh:property [ sh:path ff:anspruchAlg ; sh:in (true) ] ]
                                        [ sh:property [ sh:path ff:anspruchSoldaten ; sh:in (true) ] ]
                                    )
                                ]
                            )
                        ]
                    )
                ] .
            
            # ----- DECISION TREE LOGIC -----

            ff:uebergangsgeldFlowShape a sh:NodeShape ;
                sh:targetClass ff:Citizen ;
            
                sh:property ff:baseRequirements ;
                sh:property ff:ausbildungPS ;
                sh:property ff:berufsrueckPS ;
                sh:property ff:vorbeschaeftigungszeit3JahrePS ;
                sh:property ff:vorbeschaeftigungszeitPS .
            
            ff:baseRequirements a sh:PropertyShape ;
                sh:property [ sh:path ff:has_disability ; sh:minCount 1 ] ;
                sh:property [ sh:path ff:rehabilitation_provider ; sh:minCount 1 ] .
            
            ff:ausbildungPS a sh:PropertyShape ;
                sh:deactivated [
                    sh:not [ sh:and (
                        [ shn:eq ( [ sh:path ff:has_disability ] true ) ] 
                        [ shn:eq ( [ sh:path ff:rehabilitation_provider ] ff:rehabilitation_provider-bundesagentur-fuer-arbeit ) ] 
                    ) ]
                ] ;
                sh:path ff:berufsausbildungsabschluss ;
                sh:minCount 1 .
            
            ff:berufsrueckPS a sh:PropertyShape ;
                sh:deactivated [
                    sh:not [ sh:and (
                        [ shn:eq ( [ sh:path ff:has_disability ] true ) ] 
                        [ shn:eq ( [ sh:path ff:rehabilitation_provider ] ff:rehabilitation_provider-bundesagentur-fuer-arbeit ) ] 
                        [ shn:eq ( [ sh:path ff:berufsausbildungsabschluss ] false ) ]
                    ) ]
                ] ;
                sh:path ff:berufsrueckkehrer ;
                sh:minCount 1 .
            
            ff:vorbeschaeftigungszeit3JahrePS a sh:PropertyShape ;
                sh:deactivated [
                    sh:or (
                        [ sh:not [ sh:and (
                            [ shn:eq ( [ sh:path ff:has_disability ] true ) ] 
                            [ shn:eq ( [ sh:path ff:rehabilitation_provider ] ff:bundesagentur-fuer-arbeit ) ] 
                            [ shn:eq ( [ sh:path ff:berufsausbildungsabschluss ] false ) ]
                            [ shn:eq ( [ sh:path ff:berufsrueckkehrer ] false ) ]
                        ) ] ]
                        [ shn:eq ( [ sh:path ff:sozialversichert12in3 ] true ) ]
                        [ shn:eq ( [ sh:path ff:anspruchAlgIn3 ] true ) ]
                        [ shn:eq ( [ sh:path ff:anspruchSoldatenIn3 ] true ) ]
                    )
                ] ;
                sh:property [ sh:path ff:sozialversichert12in3 	; sh:minCount 1 ] ;
                sh:property [ sh:path ff:anspruchAlgIn3 ; sh:minCount 1 ] ;
                sh:property [ sh:path ff:anspruchSoldatenIn3 ; sh:minCount 1 ] .
            
            ff:vorbeschaeftigungszeitPS a sh:PropertyShape ;
                sh:deactivated [
                    sh:or (
                      [ sh:not [ sh:and (
                          [ shn:eq ( [ sh:path ff:has_disability ] true ) ] 
                          [ shn:eq ( [ sh:path ff:rehabilitation_provider ] ff:rehabilitation_provider-bundesagentur-fuer-arbeit ) ] 
                          [ shn:eq ( [ sh:path ff:berufsausbildungsabschluss ] false ) ]
                          [ shn:eq ( [ sh:path ff:berufsrueckkehrer ] true ) ]
                      ) ] ]
                      [ shn:eq ( [ sh:path ff:sozialversichert12 ] true ) ]
                      [ shn:eq ( [ sh:path ff:anspruchAlg ] true ) ]
                      [ shn:eq ( [ sh:path ff:anspruchSoldaten ] true ) ]
                    )
                ] ;
                sh:property [ sh:path ff:sozialversichert12	; sh:minCount 1 ] ;
                sh:property [ sh:path ff:anspruchAlg ; sh:minCount 1 ] ;
                sh:property [ sh:path ff:anspruchSoldaten ; sh:minCount 1 ] .`
        matchingEngine.addRequirementProfileTurtle(shacl)
        await addRpsFromKnowledgeBase(familienleistungenRpUris)
        await matchingEngine.init()
    })

    async function journeyLoop(upMap, initialUp, rpUris) {
        let upStore = storeFromTurtles([initialUp])
        let reportStore
        let keepGoing = true
        while (keepGoing) {
            reportStore = await matchingEngine.matching(await storeToTurtle(upStore), rpUris, MATCHING_MODE.QUIZ, FORMAT.STORE, true)
            let query = `
                PREFIX ff: <https://foerderfunke.org/default#>
                SELECT ?subject ?df WHERE {
                    ?report ff:hasMostMissedDatafield ?dfObj .
                    ?dfObj rdf:subject ?subject ;
                        rdf:predicate ?df .
                }`
            let rows = await sparqlSelect(query, [reportStore])
            if (rows.length === 0) {
                keepGoing = false
                break
            }
            let subject = shrink(rows[0].subject)
            let df = shrink(rows[0].df)
            let value = upMap[subject]?.[df]
            if (value === undefined) {
                keepGoing = false
                break
            }
            query = `
                PREFIX ff: <https://foerderfunke.org/default#>
                INSERT DATA { ${subject} ${df} ${value} }`
            await sparqlInsertDelete(query, upStore)
        }
        return upStore
    }

    it("happy path of nested sh:or-case should work", async function () {
        // in the head of the user, before having answered questions
        let upMap = {
            "ff:mainPerson": {
                "ff:has_disability": true,
                "ff:rehabilitation_provider": "ff:rehabilitation_provider-bundesagentur-fuer-arbeit",
                "ff:berufsausbildungsabschluss": false,
                "ff:berufsrueckkehrer": true,
                "ff:sozialversichert12": true
            }
        }
        let initialUp = `
            @prefix ff: <https://foerderfunke.org/default#> .
            ff:mainPerson a ff:Citizen .`
        let upStore = await journeyLoop(upMap, initialUp, [expand("ff:uebergangsgeld-behinderung")])
        const actualUp = await storeToTurtle(upStore)
        const expectedUp = `
            @prefix ff: <https://foerderfunke.org/default#>.
            @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>.
            ff:mainPerson a ff:Citizen;
              ff:berufsausbildungsabschluss false;
              ff:berufsrueckkehrer true;
              ff:has_disability true;
              ff:rehabilitation_provider ff:rehabilitation_provider-bundesagentur-fuer-arbeit;
              ff:sozialversichert12 true.`
        strictEqual(isomorphicTurtles(actualUp, expectedUp), true, "The user profile at the end of the matching journey is not as expected")
    })

    it("test path through Familienleistungen", async function () {
        let upMap = {
            "ff:mainPerson": {
                "ff:aufenthaltsort": "ff:aufenthaltsort-ao-innerhalb"
            }
        }
        let initialUp = `
            @prefix ff: <https://foerderfunke.org/default#> .
            ff:mainPerson a ff:Citizen .`
        let upStore = await journeyLoop(upMap, initialUp, familienleistungenRpUris)
        // console.log(await storeToTurtle(upStore))
        // TODO
    })
})
