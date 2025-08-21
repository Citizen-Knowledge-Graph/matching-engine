import { getRdf, buildValidatorFromDataset, datasetFromStore, datasetFromTurtles, expand, newStore, nnExpand, parseObject, storeFromTurtles, storeToTurtle, sparqlConstruct, sparqlAsk, addTriple, storeToJsonLdObj, formatTimestamp, a, sparqlInsertDelete, storeFromDataset, addStoreToStore, datasetToTurtle } from "@foerderfunke/sem-ops-utils"
import { FORMAT, QUERY_INSERT_VALIDATION_REPORT_URI } from "./queries.js"

const ns = {
    ff: getRdf().namespace("https://foerderfunke.org/default#")
}

export class ProfileManager {
    constructor() {
        this.turtles = { datafields: [], definitions: [], materialization: [], consistency: [] }
        this.profiles = {}
    }
    addDatafieldsTurtle(turtle) { this.turtles.datafields.push(turtle) }
    addDefinitionsTurtle(turtle) { this.turtles.definitions.push(turtle) }
    addMaterializationTurtle(turtle) { this.turtles.materialization.push(turtle) }
    addConsistencyTurtle(turtle) { this.turtles.consistency.push(turtle) }
    async init() {
        this.defStore = storeFromTurtles([...this.turtles.datafields, ...this.turtles.definitions, ...this.turtles.materialization])
        this.defDataset = datasetFromStore(this.defStore) // for grapoi
        this.datafieldsValidator = buildValidatorFromDataset(datasetFromTurtles(this.turtles.datafields))
        this.consistencyValidator = buildValidatorFromDataset(datasetFromTurtles(this.turtles.consistency))
        this.matQueries = {}
        for (const quad of this.defDataset.match(null, ns.ff.sparqlConstructQuery, null)) {
            this.matQueries[quad.subject.value] = quad.object.value.trim()
        }
    }
    getProfilesInfo() {
        return Object.entries(this.profiles).map(([id, profile]) => { return { id: id, nickname: profile.nickname }})
    }
    getProfile(id) {
        return this.profiles[id]
    }
    generateProfileId() {
        return "ff:citizen" + (Object.keys(this.profiles).length + 1)
    }
    newProfile(id) {
        if (!id) id = this.generateProfileId()
        this.profiles[id] = new Profile(id, this)
        this.profiles[id].addEntry(id, "rdf:type", "ff:Citizen")
        return id
    }
    importProfileTurtle(id, turtle) {
        if (!id) id = this.generateProfileId()
        this.profiles[id] = new Profile(id, this)
        this.profiles[id].importTurtle(turtle)
        return id
    }
    duplicateProfile() {}
}

class Profile {
    constructor(id, profileManager) {
        this.id = id
        this.profileManager = profileManager
        this.nickname = null
        this.store = newStore()
        this.enrichedDataset = null
    }
    addEntry(individual, datafield, value) {
        this.store.addQuad(nnExpand(individual), nnExpand(datafield), parseObject(value))
    }
    changeEntry(individual, datafield, oldValue, newValue) {
        this.removeEntry(individual, datafield, oldValue)
        this.addEntry(individual, datafield, newValue)
    }
    removeEntry(individual, datafield, value) {
        this.store.removeQuad(nnExpand(individual), nnExpand(datafield), parseObject(value))
    }
    addIndividual(clazz) {
        let count = this.store.match(null, nnExpand("rdf:type"), nnExpand(clazz)).size
        const uri = expand(clazz).toLowerCase() + (count + 1)
        this.addEntry(uri, "rdf:type", clazz)
        return uri
    }
    async materializeAndValidate(format = FORMAT.TURTLE, testMode = false) {
        let query = `
            PREFIX ff: <https://foerderfunke.org/default#>
            ASK { ?user a ff:Citizen . }`
        if (!await sparqlAsk(query, [this.store])) {
            throw new Error("User profile does not contain an individual of class ff:Citizen")
        }
        let reportStore = newStore()
        let reportUri = expand("ff:profileReport") + (testMode ? "_STATIC_TEST_URI" : formatTimestamp(new Date(), true))
        addTriple(reportStore, reportUri, a, expand("ff:MaterializeAndValidateProfileReport"))
        await this.materialize(reportStore, reportUri)
        await this.validate(reportStore, reportUri)
        switch (format) {
            case FORMAT.STORE:
                return reportStore
            case FORMAT.JSON_LD:
                return await storeToJsonLdObj(reportStore, ["ff:MaterializeAndValidateProfileReport"])
            case FORMAT.TURTLE:
                return await storeToTurtle(reportStore)
            default:
                throw new Error("Unknown format: " + format)
        }
    }
    async materialize(reportStore, reportUri) {
        let enrichedStore = newStore()
        addStoreToStore(this.store, enrichedStore)
        let count = 0
        let materializedTriples = 0
        for (let [ matRuleUri, query ] of Object.entries(this.profileManager.matQueries)) {
            // eventually we need an exhaustive approach: materialize until nothing new gets materialized
            // filling the store while also using it as source could create build-ups with side effects?
            let materializedQuads = await sparqlConstruct(query, [this.store, this.profileManager.defStore], enrichedStore)
            if (materializedQuads.length === 0) continue
            materializedTriples += materializedQuads.length
            let matUri = expand("ff:materialization") + count
            addTriple(reportStore, reportUri, expand("ff:hasMaterialization"), matUri)
            addTriple(reportStore, matUri, expand("ff:fromRule"), matRuleUri)
            let c = 0
            for (let quad of materializedQuads) {
                let matTripleUri = matUri + "triple" + (c ++)
                addTriple(reportStore, matUri, expand("ff:generatedTriple"), matTripleUri)
                addTriple(reportStore, matTripleUri, expand("rdf:subject"), quad.subject)
                addTriple(reportStore, matTripleUri, expand("rdf:predicate"), quad.predicate)
                addTriple(reportStore, matTripleUri, expand("rdf:object"), quad.object)
            }
            count ++
        }
        addTriple(reportStore, reportUri, expand("ff:hasNumberOfMaterializedTriples"), materializedTriples)
        this.enrichedDataset = datasetFromStore(enrichedStore)
    }
    async validate(reportStore, reportUri) {
        // plausibility validation
        let pReport = await this.profileManager.datafieldsValidator.validate({ dataset: this.enrichedDataset })
        addTriple(reportStore, reportUri, expand("ff:passesPlausibilityValidation"), pReport.conforms)
        if (!pReport.conforms) {
            let pReportStore = storeFromDataset(pReport.dataset)
            let reportName = "ff:plausibilityValidationReport"
            addTriple(reportStore, reportUri, expand("ff:hasValidationReport"), expand(reportName))
            await sparqlInsertDelete(QUERY_INSERT_VALIDATION_REPORT_URI(reportName), pReportStore)
            addStoreToStore(pReportStore, reportStore)
        }
        // logical consistency validation
        let lcReport = await this.profileManager.consistencyValidator.validate({ dataset: this.enrichedDataset })
        addTriple(reportStore, reportUri, expand("ff:passesLogicalConsistencyValidation"), lcReport.conforms)
        if (!lcReport.conforms) {
            let lcReportStore = storeFromDataset(lcReport.dataset)
            let reportName = "ff:logicalConsistencyValidationReport"
            addTriple(reportStore, reportUri, expand("ff:hasValidationReport"), expand(reportName))
            await sparqlInsertDelete(QUERY_INSERT_VALIDATION_REPORT_URI(reportName), lcReportStore)
            addStoreToStore(lcReportStore, reportStore)
        }
    }
    importTurtle(turtle) {
        this.store = storeFromTurtles([turtle])
    }
    async toTurtle() {
        return await storeToTurtle(this.store)
    }
    async enrichedToTurtle() {
        return await datasetToTurtle(this.enrichedDataset)
    }
}
