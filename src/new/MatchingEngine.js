import { buildValidator, extractFirstIndividualUriFromTurtle, storeFromTurtles, turtleToDataset, newStore, addTurtleToStore, storeFromDataset, sparqlConstruct, storeToTurtle, sparqlSelectOnStore, quadToTriple, addTripleToStore, expandShortenedUri, a, datasetFromStore } from "sem-ops-utils"
import { QUERY_ELIGIBILITY_STATUS, QUERY_MISSING_DATAFIELDS, QUERY_VIOLATING_DATAFIELDS } from "./queries.js"

export class MatchingEngine {

    constructor(datafieldsTurtle, materializationTurtle, requirementProfilesTurtles) {
        this.dfMatStore = storeFromTurtles([datafieldsTurtle, materializationTurtle])
        this.datafieldsValidator = buildValidator(datafieldsTurtle)
        this.requirementProfilesStore = newStore()
        this.validators = {}
        for (let rpTurtle of requirementProfilesTurtles) this.addValidator(rpTurtle)
        this.matQueries = {}
        let query = `
            PREFIX ff: <https://foerderfunke.org/default#>
            SELECT * WHERE { ?uri ff:sparqlConstructQuery ?query . }`
        sparqlSelectOnStore(query, this.dfMatStore).then(rows => {
            for (let row of rows) {
                this.matQueries[row.uri] = row.query
            }
        })
    }

    addValidator(rpTurtle) {
        addTurtleToStore(this.requirementProfilesStore, rpTurtle)
        let rpUri = extractFirstIndividualUriFromTurtle(rpTurtle, "ff:RequirementProfile")
        if (rpUri) this.validators[rpUri] = buildValidator(rpTurtle)
    }

    async basicValidation(upTurtle, rpUri) {
        return await this.validators[rpUri].validate({ dataset: turtleToDataset(upTurtle) })
    }

    async validateAgainstDatafieldShapes(upTurtle) {
        return await this.datafieldsValidator.validate({ dataset: turtleToDataset(upTurtle) })
    }

    async quizMatching(upTurtle, rpUris) {
        let targetStore = await this.matching(upTurtle, rpUris, [
            QUERY_ELIGIBILITY_STATUS,
            QUERY_MISSING_DATAFIELDS
        ])
        return await storeToTurtle(targetStore)
    }

    async detailedMatching(upTurtle, rpUris) {
        let targetStore = await this.matching(upTurtle, rpUris, [
            QUERY_ELIGIBILITY_STATUS,
            QUERY_MISSING_DATAFIELDS,
            QUERY_VIOLATING_DATAFIELDS
        ])
        return await storeToTurtle(targetStore)
    }

    async matching(upTurtle, rpUris, queries) {
        let reportStore = newStore()

        let upStore = storeFromTurtles([upTurtle])
        let count = 0
        for (let [ matUri, query ] of Object.entries(this.matQueries)) {
            // do we need an exhausting approach instead until nothing is materialized anymore instead of a one-time for loop?
            // also filling the upStore while also using it as source can create build-ups
            let constructedQuads = await sparqlConstruct(query, [upStore, this.dfMatStore], upStore)
            for (let quad of constructedQuads) {
                let constructUri = expandShortenedUri("ff:constructedTriple") + "_" + (count ++)
                let triple = quadToTriple(quad)
                addTripleToStore(reportStore, constructUri, a, expandShortenedUri("ff:ConstructedTriple"))
                addTripleToStore(reportStore, constructUri, expandShortenedUri("ff:fromMaterializationRule"), matUri)
                addTripleToStore(reportStore, constructUri, expandShortenedUri("ff:hasSubject"), triple.s)
                addTripleToStore(reportStore, constructUri, expandShortenedUri("ff:hasPredicate"), triple.p)
                addTripleToStore(reportStore, constructUri, expandShortenedUri("ff:hasObject"), triple.o)
            }

        }
        let upDataset = datasetFromStore(upStore)
        // validate user profile TODO

        for (let rpUri of rpUris) {
            let report = await this.validators[rpUri].validate({ dataset: upDataset })
            let sourceStore = storeFromDataset(report.dataset) // store this in class object for reuse until overwritten again?
            for (let query of queries) {
                await sparqlConstruct(query(rpUri), [sourceStore], reportStore)
            }
        }
        return reportStore
    }
}
