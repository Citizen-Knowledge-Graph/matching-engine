import { buildValidator, extractFirstIndividualUriFromTurtle, storeFromTurtles, turtleToDataset, newStore, addTurtleToStore, storeFromDataset, sparqlConstruct, storeToTurtle, sparqlSelect, addTripleToStore, expand, a, datasetFromStore, storeToJsonLdObj, sparqlInsertDelete, turtleToJsonLdObj } from "sem-ops-utils"
import { FORMAT, MATCHING_MODE, QUERY_ELIGIBILITY_STATUS, QUERY_MISSING_DATAFIELDS, QUERY_NUMBER_OF_MISSING_DATAFIELDS, QUERY_TOP_MISSING_DATAFIELD, QUERY_VIOLATING_DATAFIELDS, QUERY_BUILD_INDIVIDUALS_TREE, QUERY_EXTRACT_INVALID_INDIVIDUALS, QUERY_HASVALUE_FIX } from "./queries.js"
import { Graph } from "./Graph.js"

export class MatchingEngine {

    constructor(datafieldsTurtle, materializationTurtle, requirementProfilesTurtles) {
        this.datafieldsTurtle = datafieldsTurtle
        this.dfMatStore = storeFromTurtles([datafieldsTurtle, materializationTurtle])
        this.datafieldsValidator = buildValidator(datafieldsTurtle)
        this.requirementProfilesStore = newStore()
        this.validators = {}
        for (let rpTurtle of requirementProfilesTurtles) this.addValidator(rpTurtle)
        this.matQueries = {}
        let query = `
            PREFIX ff: <https://foerderfunke.org/default#>
            SELECT * WHERE { ?uri ff:sparqlConstructQuery ?query . }`
        sparqlSelect(query, this.dfMatStore).then(rows => {
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

    getAllRpUris() {
        return Object.keys(this.validators)
    }

    async getDatafieldDefinitions() {
        if (!this.dfJsonld) {
            this.dfJsonld = await turtleToJsonLdObj(this.datafieldsTurtle)
        }
        return this.dfJsonld
    }

    async basicValidation(upTurtle, rpUri) {
        return await this.validators[rpUri].validate({ dataset: turtleToDataset(upTurtle) })
    }

    async validateAgainstDatafieldShapes(upTurtle) {
        return await this.datafieldsValidator.validate({ dataset: turtleToDataset(upTurtle) })
    }

    async matching(upTurtle, rpUris, matchingMode, format) {
        let reportStore = newStore()

        let upStore = storeFromTurtles([upTurtle])
        let count = 0
        for (let [ matUri, query ] of Object.entries(this.matQueries)) {
            // do we need an exhausting approach instead until nothing is materialized anymore instead of a one-time for loop?
            // also filling the upStore while also using it as source could create build-ups with side effects?
            let materializedQuads = await sparqlConstruct(query, [upStore, this.dfMatStore], upStore)
            if (matchingMode !== MATCHING_MODE.FULL || materializedQuads.length === 0) continue
            let matQueryResultUri = expand("ff:materializationQueryResult") + "_" + (count ++)
            addTripleToStore(reportStore, matQueryResultUri, a, expand("ff:MaterializationQueryResult"))
            addTripleToStore(reportStore, matQueryResultUri, expand("ff:fromMaterializationRule"), matUri)
            let c = 0
            for (let quad of materializedQuads) {
                let matTripleUri = expand("ff:materializedTriple") + "_" + (c ++)
                addTripleToStore(reportStore, matQueryResultUri, expand("ff:hasTriple"), matTripleUri)
                addTripleToStore(reportStore, matTripleUri, a, expand("rdf:Statement"))
                addTripleToStore(reportStore, matTripleUri, expand("rdf:subject"), quad.subject)
                addTripleToStore(reportStore, matTripleUri, expand("rdf:predicate"), quad.predicate)
                addTripleToStore(reportStore, matTripleUri, expand("rdf:object"), quad.object)
            }
        }
        let upDataset = datasetFromStore(upStore)

        let dfReport = await this.datafieldsValidator.validate({ dataset: upDataset })
        addTripleToStore(reportStore, expand("ff:UserProfile"), expand("sh:conforms"), dfReport.conforms)
        if (!dfReport.conforms) {
            // TODO
        }

        // if subindividuals exist, we built the individuals-tree
        // regex on " a " is a quick and dirty solution to detect individuals for now
        const matches = upTurtle.match(/ a /g)
        let individualsTree
        if (matches && matches.length > 1) {
            individualsTree = new Graph()
            let constructedQuads = await sparqlConstruct(QUERY_BUILD_INDIVIDUALS_TREE, [upStore])
            for (let quad of constructedQuads) individualsTree.processQuad(quad)
            console.log(individualsTree)
            // TODO
        }

        let missingDfStore
        for (let rpUri of rpUris) {
            let report = await this.validators[rpUri].validate({ dataset: upDataset })
            let sourceStore = storeFromDataset(report.dataset) // store this in class object for reuse until overwritten again?

            await sparqlInsertDelete(QUERY_HASVALUE_FIX, sourceStore)
            await sparqlConstruct(QUERY_ELIGIBILITY_STATUS(rpUri), [sourceStore], reportStore)

            missingDfStore = matchingMode === MATCHING_MODE.QUIZ ? newStore() : reportStore
            await sparqlConstruct(QUERY_MISSING_DATAFIELDS(rpUri), [sourceStore], missingDfStore)

            if (matchingMode === MATCHING_MODE.FULL) {
                await sparqlConstruct(QUERY_VIOLATING_DATAFIELDS(rpUri), [sourceStore], reportStore)
            }

            if (individualsTree) {
                let constructedQuads = await sparqlConstruct(QUERY_EXTRACT_INVALID_INDIVIDUALS, [sourceStore])
                // TODO
            }
        }
        await sparqlConstruct(QUERY_TOP_MISSING_DATAFIELD, [missingDfStore], reportStore)
        await sparqlConstruct(QUERY_NUMBER_OF_MISSING_DATAFIELDS, [missingDfStore], reportStore)

        if (format === FORMAT.JSON_LD) return await storeToJsonLdObj(reportStore)
        return await storeToTurtle(reportStore)
    }
}
