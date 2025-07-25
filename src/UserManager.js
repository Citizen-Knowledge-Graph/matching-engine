import { newStore } from "@foerderfunke/sem-ops-utils"

export class UserManager {
    constructor(matchingEngine) {
        this.matchingEngine = matchingEngine
        this.users = {}
        this.activeUser = null
    }
    import() {}
    exportAll() {}
    serializeAll() {}
    duplicateUser() {}
}

class User {
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
