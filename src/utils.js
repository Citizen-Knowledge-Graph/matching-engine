import { expand } from "@foerderfunke/sem-ops-utils"

export function extractSubjectForPredicate(turtle, predicate) {
    const regex = new RegExp(`(.*?)\\s+${predicate}\\s+`)
    const match = turtle.match(regex)
    if (match) return expand(match[1].trim())
    console.error(`Could not extract subject for predicate ${predicate} from turtle string`)
    return ""
}

export function logPerf(label, start) {
    console.log(`${label} took: ${Math.round(performance.now() - start)} ms`)
}
