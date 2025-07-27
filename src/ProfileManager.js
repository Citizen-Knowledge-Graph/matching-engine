import { newStore } from "@foerderfunke/sem-ops-utils"

export class ProfileManager {
    constructor() {
        this.profiles = {}
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
    addEntry(individual, datafield, value) {}
    changeEntry(individual, datafield, newValue) {}
    removeEntry(individual, datafield) {}
    addIndividual(clazz) {}
    materialize() {}
    validate() {}
    export() {}
    serialize() {}
}
