export const STATUS = {
    OK: "ok",
    VIOLATION: "violation",
    MISSING: "missing"
}
const { OK, VIOLATION, MISSING } = STATUS

function andStatus(a, b) {
    if (a === VIOLATION || b === VIOLATION) return VIOLATION
    if (a === MISSING || b === MISSING) return MISSING
    return OK
}

function orStatus(a, b) {
    if (a === OK || b === OK) return OK
    if (a === MISSING || b === MISSING) return MISSING
    return VIOLATION
}

function notStatus(s) {
    if (s === OK) return VIOLATION
    if (s === VIOLATION) return OK
    return MISSING
}

export class Graph {
    constructor(root) {
        this.root = root
    }
    eval() {
        const res = this.root.eval()
        this.conforms = res === OK
        return res
    }
}

export class Node {
    constructor(children = []) {
        this.children = children
    }
    eval() {
        this.status = OK
        for (const c of this.children) this.status = andStatus(this.status, c.eval())
        return this.status
    }
}

export class NodeROOT extends Node {}
export class NodeAND extends Node {}
export class NodeDATAFIELD extends Node {}

export class NodeOR extends Node {
    eval() {
        this.status = VIOLATION
        for (const c of this.children) this.status = orStatus(this.status, c.eval())
        return this.status;
    }
}

export class NodeNOT extends Node {
    eval() {
        const childStat = this.children[0]?.eval() ?? OK // default true
        this.status = notStatus(childStat)
        return this.status;
    }
}

export class NodeRULE extends Node {
    eval() {
        return this.shaclEval.status
    }
}
