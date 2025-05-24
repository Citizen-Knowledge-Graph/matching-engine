import { buildValidator, extractFirstIndividualUriFromTurtle, storeFromTurtles, turtleToDataset, newStore, addTurtleToStore, storeFromDataset, sparqlConstruct, storeToTurtle, sparqlSelect, addTriple, expand, a, datasetFromStore, storeToJsonLdObj, sparqlInsertDelete, formatTimestamp, formatTimestampAsLiteral, addStoreToStore } from "@foerderfunke/sem-ops-utils"
import { FORMAT, MATCHING_MODE, QUERY_ELIGIBILITY_STATUS, QUERY_MISSING_DATAFIELDS, QUERY_NUMBER_OF_MISSING_DATAFIELDS, QUERY_TOP_MISSING_DATAFIELD, QUERY_BUILD_INDIVIDUALS_TREE, QUERY_EXTRACT_INVALID_INDIVIDUALS, QUERY_HASVALUE_FIX, QUERY_METADATA_RPS, QUERY_METADATA_DFS, QUERY_METADATA_BCS, QUERY_INSERT_VALIDATION_REPORT_URI, QUERY_DELETE_NON_VIOLATING_VALIDATION_RESULTS, QUERY_LINK_REPORT_ONLY_IF_EXISTS } from "./queries.js"
import { Graph } from "./rule-graph/Graph.js"
import { inspect } from "util"
import { ruleGraphFromShacl } from "./rule-graph/import/fromShacl.js"
import { ruleGraphToMermaid } from "./rule-graph/export/toMermaid.js"

export class MatchingEngine {

    constructor(datafieldsTurtle, materializationTurtle, consistencyTurtle, requirementProfilesTurtles) {
        this.datafieldsTurtle = datafieldsTurtle
        this.dfMatStore = storeFromTurtles([datafieldsTurtle, materializationTurtle])
        this.datafieldsValidator = buildValidator(datafieldsTurtle)
        this.consistencyValidator = buildValidator(consistencyTurtle)
        this.requirementProfilesStore = newStore()
        this.validators = {}
        for (let rpTurtle of requirementProfilesTurtles) this.addValidator(rpTurtle)
        this.matQueries = {}
        this.metadata = {}
    }

    // no more addValidator() after calling init()
    async init(lang = "en", metadataFormat = FORMAT.JSON_LD) {
        this.lang = lang
        this.metadataFormat = metadataFormat
        // materialization queries
        let query = `
            PREFIX ff: <https://foerderfunke.org/default#>
            SELECT * WHERE { ?uri ff:sparqlConstructQuery ?query . }`
        let rows = await sparqlSelect(query, this.dfMatStore)
        for (let row of rows) {
            this.matQueries[row.uri] = row.query
        }
        // metadata
        let metadataStore = newStore()
        let rootUri = expand("ff:metadata")
        addTriple(metadataStore, rootUri, a, expand("ff:MetadataExtraction"))
        addTriple(metadataStore, rootUri, expand("ff:hasLanguage"), this.lang)
        await sparqlConstruct(QUERY_METADATA_RPS(rootUri, this.lang), [this.requirementProfilesStore], metadataStore)
        await sparqlConstruct(QUERY_METADATA_DFS(rootUri, this.lang), [this.dfMatStore], metadataStore)
        await sparqlConstruct(QUERY_METADATA_BCS(rootUri, this.lang), [this.dfMatStore], metadataStore)
        this.metadata = this.metadataFormat === FORMAT.JSON_LD ? await storeToJsonLdObj(metadataStore, ["ff:MetadataExtraction"]) : await storeToTurtle(metadataStore)
        return this
    }

    addValidator(rpTurtle) {
        addTurtleToStore(this.requirementProfilesStore, rpTurtle)
        let rpUri = extractFirstIndividualUriFromTurtle(rpTurtle, "ff:RequirementProfile")
        if (rpUri) this.validators[rpUri] = buildValidator(rpTurtle, false, true)
    }

    getAllRpUris() {
        return Object.keys(this.validators)
    }

    async basicValidation(upTurtle, rpUri) {
        return await this.validators[rpUri].validate({ dataset: turtleToDataset(upTurtle) })
    }

    async enrichAndValidateUserProfile(upTurtle, reportUri, reportStore, matchingMode) {
        let upStore = storeFromTurtles([upTurtle])

        reportUri = reportUri ?? expand("ff:userProfileValidationReport")
        reportStore = reportStore ?? newStore()
        matchingMode = matchingMode ?? MATCHING_MODE.QUIZ

        // materialization
        let count = 0
        let materializedTriples = 0
        for (let [ matUri, query ] of Object.entries(this.matQueries)) {
            // do we need an exhausting approach instead until nothing is materialized anymore instead of a one-time for loop?
            // also filling the upStore while also using it as source could create build-ups with side effects?
            let materializedQuads = await sparqlConstruct(query, [upStore, this.dfMatStore], upStore)
            materializedTriples += materializedQuads.length
            if (matchingMode !== MATCHING_MODE.FULL || materializedQuads.length === 0) continue
            let matResultUri = expand("ff:matRes") + count
            addTriple(reportStore, reportUri, expand("ff:hasMaterializationResult"), matResultUri)
            // addTriple(reportStore, matResultUri, a, expand("ff:MaterializationResult"))
            addTriple(reportStore, matResultUri, expand("ff:fromRule"), matUri)
            let c = 0
            for (let quad of materializedQuads) {
                let matTripleUri = expand("ff:matRes") + count + "triple" + (c ++)
                addTriple(reportStore, matResultUri, expand("ff:hasTriple"), matTripleUri)
                // addTriple(reportStore, matTripleUri, a, expand("ff:MaterializedTriple"))
                addTriple(reportStore, matTripleUri, expand("rdf:subject"), quad.subject)
                addTriple(reportStore, matTripleUri, expand("rdf:predicate"), quad.predicate)
                addTriple(reportStore, matTripleUri, expand("rdf:object"), quad.object)
            }
            count ++
        }
        if (materializedTriples > 0) {
            addTriple(reportStore, reportUri, expand("ff:materializedTriples"), materializedTriples)
        }
        let upDataset = datasetFromStore(upStore)

        // plausibility validation
        let dfReport = await this.datafieldsValidator.validate({ dataset: upDataset })
        addTriple(reportStore, reportUri, expand("ff:upPassesPlausibilityCheck"), dfReport.conforms)
        if (!dfReport.conforms) {
            let dfReportStore = storeFromDataset(dfReport.dataset)
            let reportName = "ff:PlausibilityValidationReport"
            addTriple(reportStore, reportUri, expand("ff:hasValidationReport"), expand(reportName))
            await sparqlInsertDelete(QUERY_INSERT_VALIDATION_REPORT_URI(reportName), dfReportStore)
            addStoreToStore(dfReportStore, reportStore)
        }

        // logical consistency validation
        let lcReport = await this.consistencyValidator.validate({ dataset: upDataset })
        addTriple(reportStore, reportUri, expand("ff:upPassesLogicalConsistencyCheck"), lcReport.conforms)
        if (!lcReport.conforms) {
            let lcReportStore = storeFromDataset(lcReport.dataset)
            let reportName = "ff:LogicalConsistencyValidationReport"
            addTriple(reportStore, reportUri, expand("ff:hasValidationReport"), expand(reportName))
            await sparqlInsertDelete(QUERY_INSERT_VALIDATION_REPORT_URI(reportName), lcReportStore)
            addStoreToStore(lcReportStore, reportStore)
        }
        return { upStore, upDataset, reportStore }
    }

    async matching(upTurtle, rpUris, matchingMode, format, testMode = false) {
        let reportStore = newStore()

        const now = new Date()
        let reportUri = expand("ff:matchingReport") + (testMode ? "_STATIC_TEST_URI" : formatTimestamp(now, true))
        addTriple(reportStore, reportUri, a, expand("ff:MatchingReport"))
        addTriple(reportStore, reportUri, expand("ff:hasMode"), expand(matchingMode))
        addTriple(reportStore, reportUri, expand("ff:hasTimestamp"), (testMode ? "STATIC_TEST_VALUE" : formatTimestampAsLiteral(now)))

        let { upStore, upDataset } = await this.enrichAndValidateUserProfile(upTurtle, reportUri, reportStore, matchingMode)

        // if subindividuals exist, we built the individuals-tree
        // regex on " a " is a quick and dirty solution to detect individuals for now
        /*const matches = upTurtle.match(/ a /g)
        let individualsTree
        if (matches && matches.length > 1) {
            individualsTree = new Graph()
            let constructedQuads = await sparqlConstruct(QUERY_BUILD_INDIVIDUALS_TREE, [upStore])
            for (let quad of constructedQuads) individualsTree.processQuad(quad)
            console.log(individualsTree)
            // TODO
        }*/

        let missingDfStore
        for (let rpUri of rpUris) {
            let rpEvalUri = expand("ff:rpEvalRes") + "_" + rpUri.split("#").pop()
            addTriple(reportStore, reportUri, expand("ff:hasEvaluatedRequirementProfile"), rpEvalUri)
            // addTriple(reportStore, rpEvalUri, a, expand("ff:RequirementProfileEvaluationResult"))
            addTriple(reportStore, rpEvalUri, expand("ff:hasRpUri"), rpUri)

            let shaclReport = await this.validators[rpUri].validate({ dataset: upDataset })
            let sourceStore = storeFromDataset(shaclReport.dataset) // store this in class object for reuse until overwritten again?

            await sparqlInsertDelete(QUERY_HASVALUE_FIX, sourceStore)
            await sparqlConstruct(QUERY_ELIGIBILITY_STATUS(rpEvalUri), [sourceStore], reportStore)

            missingDfStore = matchingMode === MATCHING_MODE.QUIZ ? newStore() : reportStore
            await sparqlConstruct(QUERY_MISSING_DATAFIELDS(reportUri, rpEvalUri), [sourceStore], missingDfStore)

            /*if (individualsTree) {
                let constructedQuads = await sparqlConstruct(QUERY_EXTRACT_INVALID_INDIVIDUALS, [sourceStore])
                // TODO
            }*/

            if (matchingMode === MATCHING_MODE.FULL) {
                let reportName = "ff:SubjectSpecificViolationsReport" + "_" + rpUri.split("#").pop()
                await sparqlInsertDelete(QUERY_DELETE_NON_VIOLATING_VALIDATION_RESULTS, sourceStore)
                await sparqlInsertDelete(QUERY_INSERT_VALIDATION_REPORT_URI(reportName), sourceStore)
                let constructedQuads = await sparqlConstruct(QUERY_LINK_REPORT_ONLY_IF_EXISTS(reportName, rpEvalUri), [sourceStore], reportStore)
                if (constructedQuads.length > 0) {
                    addStoreToStore(sourceStore, reportStore)
                }
            }
        }

        await sparqlConstruct(QUERY_TOP_MISSING_DATAFIELD(reportUri), [missingDfStore], reportStore)
        await sparqlConstruct(QUERY_NUMBER_OF_MISSING_DATAFIELDS(reportUri), [missingDfStore], reportStore)

        switch (format) {
            case FORMAT.STORE:
                return reportStore
            case FORMAT.JSON_LD:
                return await storeToJsonLdObj(reportStore, ["ff:MatchingReport"])
            case FORMAT.TURTLE:
                return await storeToTurtle(reportStore)
            default:
                throw new Error("Unknown format: " + format)
        }
    }

    async buildRuleGraph(turtle) {
        let jsonLd = await storeToJsonLdObj(storeFromTurtles([turtle]), ["sh:NodeShape"])
        // console.log(inspect(jsonLd, false, null, true))
        let graph = new Graph(ruleGraphFromShacl(jsonLd))
        console.log(inspect(graph.root, false, null, true))
        let mermaid = ruleGraphToMermaid(graph)
        console.log(mermaid)
    }
}
