
export class RuleGraph {
    constructor(rpUri) {
        this.rpUri = rpUri
        this.graphs = {} // number of sh:NodeShape's = number of different sh:targetClass's
    }
}
