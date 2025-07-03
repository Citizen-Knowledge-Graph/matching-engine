
export class EvalGraph {
    constructor(ruleGraph, individuals) {
        this.ruleGraph = ruleGraph
        this.rootNodes = {}
        for (let [indiv, cls] of Object.entries(individuals)) {
            let clonedRootNode = structuredClone(ruleGraph.rootNodes[cls])
            clonedRootNode.individualUri = indiv
            this.rootNodes[indiv] = clonedRootNode
        }
    }
}
