import { getRdf, buildValidatorFromDataset, datasetFromStore, datasetFromTurtles, expand, newStore, nnExpand, parseObject, storeFromTurtles, storeToTurtle, sparqlConstruct, sparqlAsk, datasetToTurtle } from "@foerderfunke/sem-ops-utils"

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
    generateProfileId() {
        return "profile" + (Object.keys(this.profiles).length + 1)
    }
    newProfile() {
        let id = this.generateProfileId()
        this.profiles[id] = new Profile(id, this)
        this.profiles[id].addEntry("ff:user", "rdf:type", "ff:Citizen")
        return id
    }
    importProfileTurtle(turtle) {
        let id = this.generateProfileId()
        this.profiles[id] = new Profile(id, this)
        this.profiles[id].importTurtle(turtle)
        return id
    }
    exportAll() {}
    serializeAll() {}
    duplicateProfile() {}
}

class Profile {
    constructor(id, profileManager) {
        this.id = id
        this.profileManager = profileManager
        this.nickname = null
        this.store = newStore()
        this.enrichedStore = null
    }
    addEntry(individual, datafield, value) {
        this.store.addQuad(nnExpand(individual), nnExpand(datafield), parseObject(value))
    }
    changeEntry(individual, datafield, oldValue, newValue) {
        if (oldValue === newValue) return
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
    async materializeAndValidate() {
        await this.materialize()
        return await this.validate()
    }
    async materialize() {
        this.enrichedStore = newStore()
        for (let query of Object.values(this.profileManager.matQueries)) {
            // do we need an exhausting approach instead until nothing is materialized anymore instead of a one-time for loop?
            // also filling the upStore while also using it as source could create build-ups with side effects?
            await sparqlConstruct(query, [this.store, this.profileManager.defStore], this.enrichedStore)
        }
    }
    async validate() {
        let query = `
            PREFIX ff: <https://foerderfunke.org/default#>
            ASK { ?user a ff:Citizen . }`
        if (!await sparqlAsk(query, [this.enrichedStore])) {
            return { conforms: false, report: "User profile does not contain an individual of class ff:Citizen" }
        }
        let ds = datasetFromStore(this.enrichedStore)
        // plausibility validation
        let pReport = await this.profileManager.datafieldsValidator.validate({ dataset: ds })
        if (!pReport.conforms) {
            return { conforms: false, report: await datasetToTurtle(pReport.dataset) }
        }
        // logical consistency validation
        let lcReport = await this.profileManager.consistencyValidator.validate({ dataset: ds })
        if (!lcReport.conforms) {
            return { conforms: false, report: await datasetToTurtle(lcReport.dataset) }
        }
        return { conforms: true, dataset: ds }
    }
    importTurtle(turtle) {
        this.store = storeFromTurtles([turtle])
    }
    export() {}
    async toTurtle() {
        return await storeToTurtle(this.store)
    }
}
