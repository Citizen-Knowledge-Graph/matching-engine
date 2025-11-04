import { buildValidator, extractFirstIndividualUriFromTurtle, storeFromTurtles, turtleToDataset, newStore, addTurtleToStore, storeFromDataset, sparqlConstruct, storeToTurtle, sparqlSelect, addTriple, expand, a, datasetFromStore, storeToJsonLdObj, sparqlInsertDelete, formatTimestamp, sparqlAsk, buildValidatorFromDataset, datasetFromTurtles, shrink } from "@foerderfunke/sem-ops-utils"
import { FORMAT, QUERY_ELIGIBILITY_STATUS, QUERY_MISSING_DATAFIELDS, QUERY_NUMBER_OF_MISSING_DATAFIELDS, QUERY_TOP_MISSING_DATAFIELD, QUERY_HASVALUE_FIX, QUERY_METADATA_RPS, QUERY_METADATA_DFS, QUERY_METADATA_DEFINITIONS, QUERY_GET_ALL_DFS, QUERY_GET_DF_DETAILS, QUERY_GET_DF_ANSWER_OPTIONS } from "./queries.js"
import { RawGraph } from "./rule-graph/RawGraph.js"
import { cleanGraph, EvalGraph } from "./rule-graph/EvalGraph.js"
import { extractSubjectForPredicate, logPerf } from "./utils.js";
// import util from "util" // --> don't commit uncommented, causes "Module not found: Error: Can't resolve util" in the frontend

export class MatchingEngine {

    constructor() {
        this.turtles = {
            datafields: [], definitions: [], materialization: [], consistency: [],
            requirementProfilesArr: [], requirementProfiles: {},
            infoPages: {}, def: null
        }
        this.logPerf = false
    }
    addDatafieldsTurtle(turtle) { this.turtles.datafields.push(turtle) }
    addDefinitionsTurtle(turtle) { this.turtles.definitions.push(turtle) }
    addMaterializationTurtle(turtle) { this.turtles.materialization.push(turtle) }
    addConsistencyTurtle(turtle) { this.turtles.consistency.push(turtle) }
    addRequirementProfileTurtle(turtle) { this.turtles.requirementProfilesArr.push(turtle) }
    addInfoPageTurtle(turtle) { this.turtles.infoPages[extractSubjectForPredicate(turtle, "ff:hasInfoContent")] = turtle }
    addDef(turtle) { this.turtles.def = turtle }
    turnOnPerformanceLogging() { this.logPerf = true }

    // no more addValidator() after calling init()
    async init(lang = "en", metadataFormat = FORMAT.JSON_LD) {
        const initStart = performance.now()
        if (lang === "de_es") lang = "de-x-es"
        this.lang = lang
        this.metadataFormat = metadataFormat
        const buildDefStoreStart = performance.now()
        this.defStore = storeFromTurtles([this.turtles.def])
        if (this.logPerf) logPerf("init.buildDefStore", buildDefStoreStart)
        const dsFromDefStoreStart = performance.now()
        this.defDataset = datasetFromStore(this.defStore) // for grapoi
        if (this.logPerf) logPerf("init.datasetFromDefStore", dsFromDefStoreStart)
        // this.datafieldsValidator = buildValidatorFromDataset(datasetFromTurtles(this.turtles.datafields))
        // this.consistencyValidator = buildValidatorFromDataset(datasetFromTurtles(this.turtles.consistency))
        let requirementProfilesStore = newStore()
        this.requirementProfileValidators = {}
        const addValidatorsStart = performance.now()
        for (let rpTurtle of this.turtles.requirementProfilesArr) this.addValidator(rpTurtle, requirementProfilesStore)
        if (this.logPerf) logPerf("init.addValidators", addValidatorsStart)
        // materialization queries
        this.matQueries = {}
        let query = `
            PREFIX ff: <https://foerderfunke.org/default#>
            SELECT * WHERE { ?uri ff:sparqlConstructQuery ?query . }`
        const extractMatQueriesStart = performance.now()
        let rows = await sparqlSelect(query, [this.defStore])
        for (let row of rows) this.matQueries[row.uri] = row.query
        if (this.logPerf) logPerf("init.extractMaterializationQueries", extractMatQueriesStart)
        // metadata
        this.metadata = {}
        let metadataStore = newStore()
        let rootUri = expand("ff:metadata")
        addTriple(metadataStore, rootUri, a, expand("ff:MetadataExtraction"))
        addTriple(metadataStore, rootUri, expand("ff:hasLanguage"), this.lang)
        const constructMetadataStart = performance.now()
        await sparqlConstruct(QUERY_METADATA_RPS(rootUri, this.lang === "de-x-es" ? "de" : this.lang), [requirementProfilesStore], metadataStore)
        if (this.logPerf) logPerf("init.constructMetadataRPs", constructMetadataStart)
        const constructMetadataDFsStart = performance.now()
        await sparqlConstruct(QUERY_METADATA_DFS(rootUri, this.lang), [this.defStore], metadataStore)
        if (this.logPerf) logPerf("init.constructMetadataDFs", constructMetadataDFsStart)
        const constructMetadataDefStart = performance.now()
        await sparqlConstruct(QUERY_METADATA_DEFINITIONS(rootUri, this.lang), [this.defStore], metadataStore)
        if (this.logPerf) {
            logPerf("init.constructMetadataDef", constructMetadataDefStart)
            logPerf("init.constructMetadata sum", constructMetadataStart)
        }
        const metadataFormatStart = performance.now()
        this.metadata = this.metadataFormat === FORMAT.JSON_LD ? await storeToJsonLdObj(metadataStore, ["ff:MetadataExtraction"]) : await storeToTurtle(metadataStore)
        if (this.logPerf) {
            logPerf("init.metadataFormatting", metadataFormatStart)
            logPerf("init sum", initStart)
        }
        return this
    }

    addValidator(rpTurtle, rpStore) {
        addTurtleToStore(rpStore, rpTurtle)
        let rpUri = extractFirstIndividualUriFromTurtle(rpTurtle, "ff:RequirementProfile")
        if (!rpUri) {
            console.error("No ff:RequirementProfile individual found in the provided turtle file")
            return
        }
        this.turtles.requirementProfiles[rpUri] = rpTurtle
        const debugOn = rpTurtle.includes("sh:qualifiedValueShape")
        this.requirementProfileValidators[rpUri] = buildValidator(rpTurtle, debugOn, true)
    }

    getAllRpUris() {
        return Object.keys(this.requirementProfileValidators)
    }

    async getAllDatafieldUris() {
        let rows = await sparqlSelect(QUERY_GET_ALL_DFS(this.lang), [this.defStore])
        return rows.map(row => ({ datafield: shrink(row.df), label: row.label }))
    }

    async getDetailsForDatafield(shortenedDfUri) {
        let dfUri = expand(shortenedDfUri)
        let details = await sparqlSelect(QUERY_GET_DF_DETAILS(dfUri, this.lang), [this.defStore])
        details = details[0] || {}
        let options = await sparqlSelect(QUERY_GET_DF_ANSWER_OPTIONS(dfUri, this.lang), [this.defStore])
        details.answerOptions = options || []
        details.datafield = shortenedDfUri
        // shrink URIs
        if (details.datatype) details.datatype = shrink(details.datatype)
        if (details.category) details.category = shrink(details.category)
        details.answerOptions = details.answerOptions.map(opt => opt.option = shrink(opt.option))
        return details
    }

    async basicValidation(upTurtle, rpUri) {
        return await this.requirementProfileValidators[rpUri].validate({ dataset: turtleToDataset(upTurtle) })
    }

    async enrichAndValidateUserProfile(upTurtle, reportUri, reportStore) {
        let upStore = storeFromTurtles([upTurtle])

        let query = `
            PREFIX ff: <https://foerderfunke.org/default#>
            ASK { ?user a ff:Citizen . }`
        if (!await sparqlAsk(query, [upStore])) {
            throw new Error("User profile does not contain an individual of class ff:Citizen")
        }

        reportUri = reportUri ?? expand("ff:userProfileValidationReport")
        reportStore = reportStore ?? newStore()

        // materialization
        let count = 0
        let materializedTriples = 0
        for (let [ matUri, query ] of Object.entries(this.matQueries)) {
            // do we need an exhausting approach instead until nothing is materialized anymore instead of a one-time for loop?
            // also filling the upStore while also using it as source could create build-ups with side effects?
            let materializedQuads = await sparqlConstruct(query, [upStore, this.defStore], upStore)
            materializedTriples += materializedQuads.length
            // if (matchingMode !== MATCHING_MODE.FULL || materializedQuads.length === 0) continue
            /*let matResultUri = expand("ff:matRes") + count
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
            count ++*/
        }
        if (materializedTriples > 0) {
            addTriple(reportStore, reportUri, expand("ff:materializedTriples"), materializedTriples)
        }
        return datasetFromStore(upStore)
        /*// plausibility validation
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
        return upDataset*/
    }

    async matching(upTurtleOrDataset, rpUris, format, testMode = false, continueMissingDataDespiteConforming = false) {
        let reportStore = newStore()

        let reportUri = expand("ff:matchingReport") + (testMode ? "_STATIC_TEST_URI" : formatTimestamp(new Date(), true))
        addTriple(reportStore, reportUri, a, expand("ff:MatchingReport"))

        let upDataset = typeof upTurtleOrDataset === "object"
            ? upTurtleOrDataset
            : await this.enrichAndValidateUserProfile(upTurtleOrDataset, reportUri, reportStore) // temporarily keep legacy approach

        let missingDfStore = newStore()
        for (let rpUri of rpUris) {
            let rpEvalUri = expand("ff:rpEvalRes") + "_" + rpUri.split("#").pop()
            addTriple(reportStore, reportUri, expand("ff:hasEvaluatedRequirementProfile"), rpEvalUri)
            // addTriple(reportStore, rpEvalUri, a, expand("ff:RequirementProfileEvaluationResult"))
            addTriple(reportStore, rpEvalUri, expand("ff:hasRpUri"), rpUri)

            let shaclReport = await this.requirementProfileValidators[rpUri].validate({ dataset: upDataset })
            let sourceStore = storeFromDataset(shaclReport.dataset) // store this in class object for reuse until overwritten again?

            await sparqlInsertDelete(QUERY_HASVALUE_FIX, sourceStore)
            let eligibilityQuad = await sparqlConstruct(QUERY_ELIGIBILITY_STATUS(rpEvalUri), [sourceStore], reportStore)
            if (eligibilityQuad.length === 0) continue
            let status = eligibilityQuad[0].object.value
            const handleMissingDataQuerying = async () => {
                if (status === expand("ff:ineligible")) return
                let missingDataQuads = await sparqlConstruct(QUERY_MISSING_DATAFIELDS(reportUri, rpEvalUri), [sourceStore])
                if (missingDataQuads.length === 0) return // must be ff:eligible then
                const addQuadsToMissingDfStore = () => missingDataQuads.forEach(quad => missingDfStore.addQuad(quad))
                if (status === expand("ff:missingData")) {
                    addQuadsToMissingDfStore()
                    return
                }
                if (status === expand("ff:eligible")) {
                    addTriple(reportStore, reportUri, expand("ff:hasMissingDataDespiteConformingFor"), rpEvalUri)
                    // this is in case of a conforming sh:qualifiedValueShape where the user wants to keep investigating
                    // e.g.: already eligible for child allowance because of one eligible child, but let's check the other two children as well
                    if (continueMissingDataDespiteConforming) addQuadsToMissingDfStore()
                }
            }
            await handleMissingDataQuerying() // move more logic from javascript to semantic operations TODO
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

    async buildEvaluationGraph(upTurtle, rpUri) {
        const rpTurtle = this.turtles.requirementProfiles[rpUri]
        let upStore = storeFromTurtles([upTurtle])
        for (let [, query ] of Object.entries(this.matQueries)) {
            await sparqlConstruct(query, [upStore, this.defStore], upStore)
        }
        let upDataset = datasetFromStore(upStore)
        let rpStore = storeFromTurtles([rpTurtle])
        let rawGraph = new RawGraph(rpStore.getQuads())
        let ruleGraph = rawGraph.toRuleGraph()

        let classes = Object.keys(ruleGraph.rootNodes).map(uri => `<${uri}>`).join("\n")
        let query = `
            SELECT * WHERE {
                VALUES ?class { ${classes} }
                ?individual a ?class .
            }`
        let rows = await sparqlSelect(query, [upStore])
        let individuals = {}
        for (let row of rows) individuals[row.individual] = row.class
        let evalGraph = new EvalGraph(ruleGraph, individuals)
        // console.log(util.inspect(evalGraph, false, null, true))

        let validator = buildValidatorFromDataset(datasetFromStore(rpStore), true, true)
        let report = await validator.validate({ dataset: upDataset })
        let reportStore = storeFromDataset(report.dataset)
        // await sparqlInsertDelete(QUERY_HASVALUE_FIX, reportStore) // needed?
        evalGraph.validationReportTurtle = await storeToTurtle(reportStore) // for debugging

        let reportRawGraph = new RawGraph(reportStore.getQuads())
        let validationResults = reportRawGraph.extractValidationResults(Object.keys(individuals))
        evalGraph.eval(validationResults)
        // console.log(util.inspect(evalGraph, false, null, true))
        return cleanGraph(evalGraph)
    }

    buildRuleGraph(rpUri) {
        let rpStore = storeFromTurtles([this.turtles.requirementProfiles[rpUri]])
        let rawGraph = new RawGraph(rpStore.getQuads())
        let ruleGraph = rawGraph.toRuleGraph()
        return cleanGraph(ruleGraph)
    }

    async buildInfoPage(upTurtle, rpUri) {
        let validator = buildValidator(this.turtles.infoPages[rpUri])
        let upDataset = datasetFromTurtles([upTurtle])
        let report = await validator.validate({ dataset: upDataset })
        console.log(await storeToTurtle(storeFromDataset(report.dataset)))
        // TODO
    }
}
