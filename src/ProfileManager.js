import { expand, newStore, nnExpand, parseObject, storeToTurtle } from "@foerderfunke/sem-ops-utils"

export class ProfileManager {
    constructor() {
        this.profiles = {}
    }
    newProfile() {
        let id = "profile" + (Object.keys(this.profiles).length + 1)
        this.profiles[id] = new Profile(id)
        return id
    }
    import() {}
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
    export() {}
    async toTurtle() {
        return await storeToTurtle(this.store)
    }
}
