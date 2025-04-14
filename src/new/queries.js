export const MATCHING_MODE = {
    QUIZ: 1,
    FULL: 2
}

export const FORMAT = {
    TURTLE: 1,
    JSON_LD: 2
}

// to be used on one SHACL validation report at a time

export const QUERY_ELIGIBILITY_STATUS = (rpUri) => { return `
    PREFIX ff: <https://foerderfunke.org/default#>
    PREFIX sh: <http://www.w3.org/ns/shacl#>
    CONSTRUCT {
        <${rpUri}> ff:hasEligibilityStatus ?status .
    } WHERE {
        ?report sh:conforms ?conforms .
        BIND(
            IF(
                ?conforms = true,
                ff:eligible,
                IF(
                    EXISTS {
                        ?report sh:result ?result .
                        ?result sh:sourceConstraintComponent ?type .
                        FILTER(?type NOT IN (sh:MinCountConstraintComponent, sh:QualifiedMinCountConstraintComponent))
                    },
                    ff:ineligible, ff:missingData
                )
            )
        AS ?status)
    }`
}

export const QUERY_MISSING_DATAFIELDS = (rpUri) => { return `
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX ff: <https://foerderfunke.org/default#>
    PREFIX sh: <http://www.w3.org/ns/shacl#>
    
    CONSTRUCT {
        ?indivDfId ff:isMissedBy <${rpUri}> ;
            rdf:subject ?individual ;
            rdf:predicate ?df .
    } WHERE {
        ?result a sh:ValidationResult ;
            sh:sourceConstraintComponent ?type ;
            sh:focusNode ?individual ;
            sh:resultPath ?df .
        FILTER(?type IN (sh:MinCountConstraintComponent, sh:QualifiedMinCountConstraintComponent))                
    
        FILTER NOT EXISTS {
            ?report sh:result ?otherResult .
            ?otherResult sh:sourceConstraintComponent ?otherType .
            FILTER(?otherType NOT IN (sh:MinCountConstraintComponent, sh:QualifiedMinCountConstraintComponent))
        }
     
        BIND(IRI(CONCAT(STR(?individual), "_", REPLACE(STR(?df), "^.*[#/]", ""))) AS ?indivDfId)
    }`
}

export const QUERY_TOP_MISSING_DATAFIELD = `
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX ff: <https://foerderfunke.org/default#>
    
    CONSTRUCT {
        ff:mostMissedDatafield rdf:subject ?subject ;
            rdf:predicate ?datafield .
    } WHERE {
        {
            SELECT ?subject ?datafield (COUNT(?rp) AS ?missedByCount) WHERE {
                ?dfId ff:isMissedBy ?rp ;
                    rdf:subject ?subject ;
                    rdf:predicate ?datafield .
            }
            GROUP BY ?subject ?datafield
            ORDER BY DESC(?missedByCount)
            LIMIT 1
        }
    }`

export const QUERY_NUMBER_OF_MISSING_DATAFIELDS = `
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX ff: <https://foerderfunke.org/default#>
    
    CONSTRUCT {
        ff:this ff:numberOfMissingDatafields ?missingDfs .
    } WHERE {
        {
            SELECT (COUNT(DISTINCT ?dfId) AS ?missingDfs) WHERE {
                ?dfId ff:isMissedBy ?rp .
            }
        }
    }`

export const QUERY_VIOLATING_DATAFIELDS = (rpUri) => { return `
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX ff: <https://foerderfunke.org/default#>
    PREFIX sh: <http://www.w3.org/ns/shacl#>
    CONSTRUCT {
        <${rpUri}> ff:hasViolatingDatafield ?violationId .
        ?violationId
            rdf:subject ?individual ;
            rdf:predicate ?df ;
            ff:hasViolationType ?type ;
            ff:hasMessage ?message ;
            ff:hasValue ?value .
    } WHERE {
        ?result a sh:ValidationResult ;
            sh:sourceConstraintComponent ?type ;
            sh:focusNode ?individual ;
            sh:resultPath ?df ;
        OPTIONAL { ?result sh:resultMessage ?message . }
        OPTIONAL { ?result sh:value ?value . }
        FILTER(?type != sh:MinCountConstraintComponent && ?type != sh:QualifiedMinCountConstraintComponent)
        
        BIND(IRI(CONCAT(STR(<${rpUri}>), "_", REPLACE(STR(?individual), "^.*[#/]", ""), "_", REPLACE(STR(?df), "^.*[#/]", ""))) AS ?violationId)
    }`
}
