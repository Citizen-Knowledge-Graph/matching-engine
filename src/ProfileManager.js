import { getRdf, buildValidatorFromDataset, datasetFromStore, datasetFromTurtles, expand, newStore, nnExpand, parseObject, storeFromTurtles, storeToTurtle } from "@foerderfunke/sem-ops-utils"

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
        this.profiles[id] = new Profile(id)
        this.profiles[id].addEntry("ff:user", "rdf:type", "ff:Citizen")
        return id
    }
    importProfileTurtle(turtle) {
        let id = this.generateProfileId()
        this.profiles[id] = new Profile(id)
        this.profiles[id].importTurtle(turtle)
        return id
    }
    exportAll() {}
    serializeAll() {}
    duplicateProfile() {}
}

class Profile {
    constructor(id) {
        this.id = id
        this.nickname = null
        this.store = newStore()
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
    materialize() {}
    validate() {}
    importTurtle(turtle) {
        this.store = storeFromTurtles([turtle])
    }
    export() {}
    async toTurtle() {
        return await storeToTurtle(this.store)
    }
}
