import { describe } from "mocha"
import { strictEqual } from "node:assert"
import { isomorphicTurtles } from "@foerderfunke/sem-ops-utils"
import { FORMAT } from "../src/queries.js";

describe("profile manager tests", function () {
    let profileManager

    before(async function () {
        profileManager = globalThis.profileManager
        await profileManager.init()
    })

    it("test basic triple functions", async function () {
        let id = profileManager.newProfile()
        let profile = profileManager.profiles[id]
        profile.addEntry("ff:user", "ff:hasName", "John")
        profile.addEntry("ff:user", "ff:hasAge", 30)
        profile.changeEntry("ff:user", "ff:hasAge", 30, 40)
        profile.removeEntry("ff:user", "ff:hasName", "John")
        profile.addIndividual("ff:Child")
        let actualTurtle = await profile.toTurtle()
        let expectedTurtle = `
            @prefix ff: <https://foerderfunke.org/default#> .
            ff:user a ff:Citizen ; ff:hasAge 40 .
            ff:child1 a ff:Child .`
        strictEqual(isomorphicTurtles(actualTurtle, expectedTurtle), true, "The turtles are not the same")
    })

    it("test profile import", async function () {
        let profileTurtleToImport = `
            @prefix ff: <https://foerderfunke.org/default#> .
            ff:user a ff:Citizen ; ff:hasAge 40 .`
        let profile = profileManager.profiles[profileManager.importProfileTurtle(profileTurtleToImport)]
        let exportedTurtle = await profile.toTurtle()
        strictEqual(isomorphicTurtles(profileTurtleToImport, exportedTurtle), true, "The turtles are not the same")
    })

    it("test materializeAndValidate()", async function () {
        let profileTurtleToImport = `
            @prefix ff: <https://foerderfunke.org/default#> .
            @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
            ff:user a ff:Citizen ; 
                ff:geburtsdatum "1992-05-17"^^xsd:date ;
                ff:staatsbuergerschaft ff:staatsbuergerschaft-ao-usa .`
        let profile = profileManager.profiles[profileManager.importProfileTurtle(profileTurtleToImport)]

        // report
        let actualReport = await profile.materializeAndValidate(FORMAT.TURTLE, true)
        let expectedReport = `
            @prefix ff: <https://foerderfunke.org/default#>.
            @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>.
            @prefix sh: <http://www.w3.org/ns/shacl#>.
            
            ff:materialization0
              ff:fromRule ff:CalculateAgeFromBirthdate;
              ff:generatedTriple ff:materialization0triple0.
            
            ff:materialization0triple0
              rdf:object 33;
              rdf:predicate ff:hasAge;
              rdf:subject ff:user.
            
            ff:materialization1
              ff:fromRule ff:PensionableFromBirthdate;
              ff:generatedTriple ff:materialization1triple0.
            
            ff:materialization1triple0
              rdf:object false;
              rdf:predicate ff:pensionable;
              rdf:subject ff:user.
            
            ff:materialization2
              ff:fromRule ff:InterestedInBuildingActivatorRule;
              ff:generatedTriple ff:materialization2triple0.
            
            ff:materialization2triple0
              rdf:object false;
              rdf:predicate ff:interested_in_building_renovation_FLAG;
              rdf:subject ff:user.
            
            ff:materialization3
              ff:fromRule ff:UebergangsGeldAgenturFuerArbeit;
              ff:generatedTriple
                ff:materialization3triple0,
                ff:materialization3triple1,
                ff:materialization3triple2.
            
            ff:materialization3triple0
              rdf:object true;
              rdf:predicate ff:vocational_returnee_deactivated;
              rdf:subject ff:user.
            
            ff:materialization3triple1
              rdf:object true;
              rdf:predicate ff:vocationalReturneeShape_deactivated;
              rdf:subject ff:user.
            
            ff:materialization3triple2
              rdf:object true;
              rdf:predicate ff:nonVocationalReturneeShape_deactivated;
              rdf:subject ff:user.
            
            ff:plausibilityValidationReport a sh:ValidationReport;
              sh:conforms false;
              sh:result [ a sh:ValidationResult;
                  sh:focusNode ff:user;
                  sh:resultMessage "Value is not in https://foerderfunke.org/default#staatsbuergerschaft-ao-ger, https://foerderfunke.org/default#staatsbuergerschaft-ao-eu, https://foerderfunke.org/default#staatsbuergerschaft-ao-3rd";
                  sh:resultPath ff:staatsbuergerschaft;
                  sh:resultSeverity sh:Violation;
                  sh:sourceConstraintComponent sh:InConstraintComponent;
                  sh:sourceShape [];
                  sh:value ff:staatsbuergerschaft-ao-usa
                ].
            
            ff:profileReport_STATIC_TEST_URI a ff:MaterializeAndValidateProfileReport;
              ff:hasMaterialization
                ff:materialization0,
                ff:materialization1,
                ff:materialization2,
                ff:materialization3;
              ff:hasNumberOfMaterializedTriples 6;
              ff:hasValidationReport ff:plausibilityValidationReport;
              ff:passesLogicalConsistencyValidation true;
              ff:passesPlausibilityValidation false.`
        strictEqual(isomorphicTurtles(actualReport, expectedReport), true, "The report is not as expected")

        // enriched profile
        let actualEnrichedProfile = await profile.enrichedToTurtle()
        let expectedEnrichedProfile = `
            @prefix ff: <https://foerderfunke.org/default#>.
            @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>.
            @prefix xsd: <http://www.w3.org/2001/XMLSchema#>.
            
            ff:user a ff:Citizen;
              ff:geburtsdatum "1992-05-17"^^xsd:date;
              ff:hasAge 33;
              ff:interested_in_building_renovation_FLAG false;
              ff:nonVocationalReturneeShape_deactivated true;
              ff:pensionable false;
              ff:staatsbuergerschaft ff:staatsbuergerschaft-ao-usa;
              ff:vocational_returnee_deactivated true;
              ff:vocationalReturneeShape_deactivated true.`
        strictEqual(isomorphicTurtles(actualEnrichedProfile, expectedEnrichedProfile), true, "The enriched profile is not as expected")
    })
})
