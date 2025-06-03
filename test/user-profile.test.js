import "./fixtures/common.js"
import { describe } from "mocha"
import { strictEqual } from "node:assert"
import { isomorphicTurtles, storeToTurtle } from "@foerderfunke/sem-ops-utils"

describe("testing user profile functionality", function () {
    let matchingEngine

    before(async function () {
        matchingEngine = globalThis.matchingEngine
        await matchingEngine.init()
    })

    const UP = `
        @prefix ff: <https://foerderfunke.org/default#> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        ff:mainPerson a ff:Citizen ;
            ff:staatsbuergerschaft ff:staatsbuergerschaft-ao-us ;
                ff:geburtsdatum "2005-01-02"^^xsd:date ;
                ff:hasChild ff:child0 .
        ff:child0 a ff:Child ;
            ff:hasAge 25 .`

    it("should throw error if no citizen is in profile", async function () {
        let errThrown = false
        try {
            await matchingEngine.enrichAndValidateUserProfile("");
        } catch (err) {
            errThrown = err.message === "User profile does not contain an individual of class ff:Citizen"
        } finally {
            strictEqual(errThrown, true, "The error expected for missing individual was not thrown")
        }
    })

    it("should validate simple profile", async function () {
        let { upStore, upDataset, reportStore } = await matchingEngine.enrichAndValidateUserProfile(UP)
        let actualTurtle = await storeToTurtle(reportStore)

        const expectedTurtle = `
            @prefix ff: <https://foerderfunke.org/default#>.
            @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>.
            @prefix sh: <http://www.w3.org/ns/shacl#>.
            
            ff:LogicalConsistencyValidationReport a sh:ValidationReport;
                sh:conforms false;
                sh:result [ 
                    a sh:ValidationResult;
                    sh:focusNode ff:mainPerson;
                    sh:resultMessage "A parent must be older than their child.";
                    sh:resultPath (ff:hasChild ff:hasAge);
                    sh:resultSeverity sh:Violation;
                    sh:sourceConstraintComponent sh:LessThanConstraintComponent;
                    sh:sourceShape [];
                    sh:value 25
                ].
            ff:PlausibilityValidationReport a sh:ValidationReport;
                sh:conforms false;
                sh:result [
                    a sh:ValidationResult;
                    sh:focusNode ff:mainPerson;
                    sh:resultMessage "Value is not in https://foerderfunke.org/default#staatsbuergerschaft-ao-ger, https://foerderfunke.org/default#staatsbuergerschaft-ao-eu, https://foerderfunke.org/default#staatsbuergerschaft-ao-3rd";
                    sh:resultPath ff:staatsbuergerschaft;
                    sh:resultSeverity sh:Violation;
                    sh:sourceConstraintComponent sh:InConstraintComponent;
                    sh:sourceShape [];
                    sh:value ff:staatsbuergerschaft-ao-us
                ].
            ff:userProfileValidationReport
                ff:hasValidationReport
                    ff:LogicalConsistencyValidationReport,
                    ff:PlausibilityValidationReport;
                ff:materializedTriples 6;
                ff:upPassesLogicalConsistencyCheck false;
                ff:upPassesPlausibilityCheck false.`

        strictEqual(isomorphicTurtles(actualTurtle, expectedTurtle), true, "The report in Turtle format does not match the expected one")
    })
})
