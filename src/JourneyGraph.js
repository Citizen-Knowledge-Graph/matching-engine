
export class JourneyGraph {
    constructor(rpUris, initialUp) {
        this.rpUris = rpUris
        if (!initialUp) initialUp = `@prefix ff: <https://foerderfunke.org/default#> . ff:citizen1 a ff:Citizen .`
        this.initialUP = initialUp
        this.occurringDfs = {}
        // TODO
    }
}

export class Node {
    constructor(id) {
        this.id = id
    }
}

export class Edge {
    constructor(source, target, id) {
        this.source = source
        this.target = target
        this.id = id
    }
}
