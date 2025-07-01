import { describe } from "mocha"
import { convertUserProfileToTurtle } from "../src/profile-conversion.js"
import { strictEqual } from "node:assert"
import { isomorphicTurtles } from "@foerderfunke/sem-ops-utils"

describe("test utils", function () {
    it("should convert profile JSON to Turtle format correctly", async function () {
        let userProfile = {
            "@id": "ff:quick-check-user",
            "@type": "ff:Citizen",
            "ff:kinder_unter_18": "false",
            "ff:hasAge": "40",
            "ff:hasIncome": "1234.56",
            "ff:aufenthaltsort": "ff:aufenthaltsort-ao-innerhalb",
            "ff:bezogene_leistungen": [
                "ff:bezogene_leistungen-keine"
            ],
            "ff:geburtsdatum": "2025-06-30T22:00:00.000Z"
        }
        const userProfileTurtle = await convertUserProfileToTurtle(userProfile)
        const expectedTurtle = `
            @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>.
            @prefix xsd: <http://www.w3.org/2001/XMLSchema#>.
            @prefix dcterms: <http://purl.org/dc/terms/>.
            @prefix ff: <https://foerderfunke.org/default#>.
            ff:quick-check-user a ff:Citizen;
                ff:kinder_unter_18 false;
                ff:hasAge 40;
                ff:hasIncome 1234.56;
                ff:aufenthaltsort ff:aufenthaltsort-ao-innerhalb;
                ff:bezogene_leistungen ff:bezogene_leistungen-keine;
                ff:geburtsdatum "2025-06-30"^^xsd:date.`
        strictEqual(isomorphicTurtles(userProfileTurtle, expectedTurtle), true, "The profile conversion does not match the expected one")
    })
})
