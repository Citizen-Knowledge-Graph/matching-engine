export const MATCHING_MODE = {
    QUIZ: "ff:quiz",
    FULL: "ff:full"
}

export const FORMAT = {
    TURTLE: 1,
    JSON_LD: 2
}

// to be used on one SHACL validation report at a time

export const QUERY_HASVALUE_FIX = `
    PREFIX ff: <https://foerderfunke.org/default#>
    PREFIX sh: <http://www.w3.org/ns/shacl#>
    DELETE {
        ?report sh:result ?result2 .
        ?result2 ?p ?o .
    } WHERE {
        ?report sh:result ?result1, ?result2 .
      
        ?result1 
            sh:focusNode ?focusNode ;
            sh:resultPath ?path ;
            sh:sourceConstraintComponent ?type .
        FILTER(?type IN (sh:MinCountConstraintComponent, sh:QualifiedMinCountConstraintComponent))
                 
        ?result2 
            sh:focusNode ?focusNode ;
            sh:resultPath ?path ;
            sh:sourceConstraintComponent sh:HasValueConstraintComponent ;
            ?p ?o .
}`

export const QUERY_ELIGIBILITY_STATUS = (rpEvalUri) => { return `
    PREFIX ff: <https://foerderfunke.org/default#>
    PREFIX sh: <http://www.w3.org/ns/shacl#>
    CONSTRUCT {
        <${rpEvalUri}> ff:hasEligibilityStatus ?status .
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

export const QUERY_MISSING_DATAFIELDS = (reportUri, rpEvalUri) => { return `
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX ff: <https://foerderfunke.org/default#>
    PREFIX sh: <http://www.w3.org/ns/shacl#>
    
    CONSTRUCT {
        <${reportUri}> ff:hasMissingDatafield ?indivDfId .
        ?indivDfId ff:isMissedBy <${rpEvalUri}> ;
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

export const QUERY_TOP_MISSING_DATAFIELD = (reportUri) => { return `
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX ff: <https://foerderfunke.org/default#>
    
    CONSTRUCT {
        <${reportUri}> ff:hasMostMissedDatafield ?dfId .
        ?dfId rdf:subject ?subject ;
            rdf:predicate ?datafield .
    } WHERE {
        {
            SELECT ?dfId ?subject ?datafield (COUNT(?rp) AS ?missedByCount) WHERE {
                ?dfId ff:isMissedBy ?rp ;
                    rdf:subject ?subject ;
                    rdf:predicate ?datafield .
            }
            GROUP BY ?dfId ?subject ?datafield
            ORDER BY DESC(?missedByCount)
            LIMIT 1
        }
    }`
}

export const QUERY_NUMBER_OF_MISSING_DATAFIELDS = (reportUri) => { return `
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX ff: <https://foerderfunke.org/default#>
    
    CONSTRUCT {
        <${reportUri}> ff:hasNumberOfMissingDatafields ?missingDfs .
    } WHERE {
        {
            SELECT (COUNT(DISTINCT ?dfId) AS ?missingDfs) WHERE {
                ?dfId ff:isMissedBy ?rp .
            }
        }
    }`
}

export const QUERY_VIOLATING_DATAFIELDS = (rpEvalUri) => { return `
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX ff: <https://foerderfunke.org/default#>
    PREFIX sh: <http://www.w3.org/ns/shacl#>
    CONSTRUCT {
        <${rpEvalUri}> ff:hasViolatingDatafield ?violationId .
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
        
        BIND(IRI(CONCAT(STR(<${rpEvalUri}>), "_", REPLACE(STR(?individual), "^.*[#/]", ""), "_", REPLACE(STR(?df), "^.*[#/]", ""))) AS ?violationId)
    }`
}

export const QUERY_BUILD_INDIVIDUALS_TREE = `
    PREFIX ff: <https://foerderfunke.org/default#>
    PREFIX sh: <http://www.w3.org/ns/shacl#>
    
    CONSTRUCT {
        ?parentIndividual ff:hasSubindividualClass ?subindividualClass ;
            ff:conformanceMode ?conformanceModeIndividualLevelFinal .
        ?subindividualClass ff:hasSubindividual ?individual ;
            ff:conformanceMode ?conformanceModeClassLevelFinal .
    } WHERE {
        ?parentIndividual a ?parentClass .
        ?individual a ?class .
        ?parentIndividual ?relationship ?individual .
      
        BIND(IRI(CONCAT(STR(?parentIndividual), "_", REPLACE(STR(?class), "^.*[#/]", ""))) AS ?subindividualClass)
    
        OPTIONAL {
            ?parentNodeShape sh:targetClass ?parentClass ;
                sh:property ?ps1 .
            ?ps1 sh:node ?childNodeShape ;
                 ff:conformanceMode ?conformanceModeClassLevel .
            ?childNodeShape sh:targetClass ?class ;
        }
        BIND(COALESCE(?conformanceModeClassLevel, ff:cmAtLeastOne) AS ?conformanceModeClassLevelFinal)
    
        OPTIONAL {
            ?parentNodeShape sh:targetClass ?parentClass ;
                ff:conformanceMode ?conformanceModeIndividualLevel .
        }
        BIND(COALESCE(?conformanceModeIndividualLevel, ff:cmAll) AS ?conformanceModeIndividualLevelFinal)
    }`

export const QUERY_EXTRACT_INVALID_INDIVIDUALS = `
    PREFIX ff: <https://foerderfunke.org/default#>
    PREFIX sh: <http://www.w3.org/ns/shacl#>
    
    CONSTRUCT {
        ff:validationReport ff:containsInvalidIndividual ?individual .
    } WHERE {
        ?result sh:focusNode ?individual ;
            sh:sourceConstraintComponent ?type .
        FILTER(?type NOT IN (sh:MinCountConstraintComponent, sh:NodeConstraintComponent))
    }`
