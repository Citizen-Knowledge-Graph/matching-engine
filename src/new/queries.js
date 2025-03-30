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
    PREFIX ff: <https://foerderfunke.org/default#>
    PREFIX sh: <http://www.w3.org/ns/shacl#>
    
    CONSTRUCT {
        ?indivDfId ff:isMissedBy <${rpUri}> ;
            ff:hasIndividual ?individual ;
            ff:hasDatafield ?df .
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

export const QUERY_VIOLATING_DATAFIELDS = (rpUri) => { return `
    PREFIX ff: <https://foerderfunke.org/default#>
    PREFIX sh: <http://www.w3.org/ns/shacl#>
    CONSTRUCT {
        <${rpUri}> ff:hasViolatingDatafield [
            ff:hasIndividual ?individual ;
            ff:hasDatafield ?df ;
            ff:hasViolationType ?type ;
            ff:hasMessage ?message ;
            ff:hasValue ?value ;
        ] .
    } WHERE {
        ?result a sh:ValidationResult ;
            sh:sourceConstraintComponent ?type ;
            sh:focusNode ?individual ;
            sh:resultPath ?df ;
        OPTIONAL { ?result sh:resultMessage ?message . }
        OPTIONAL { ?result sh:value ?value . }
        FILTER(?type != sh:MinCountConstraintComponent && ?type != sh:QualifiedMinCountConstraintComponent)
    }`
}
