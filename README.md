# Matching Engine

This is the heart of the [FörderFunke Web App](https://github.com/Citizen-Knowledge-Graph/foerderfunke-react-app). It takes the requirement profiles (machine readable eligibility rules for benefits, SHACL format) from the [Knowledge Base](https://github.com/Citizen-Knowledge-Graph/knowledge-base) and compares them to the user profile (RDF format). The comparison is done by running a SHACL validation for each requirement profile against the user profile. Beforehand, the user profile gets enriched via SPARQL queries that add knowledge that can be inferred without having to ask the user; like their age based on the birthday or the federal state based on their city.  

Afterwards, each requirement profile falls into one of three categories: eligible, ineligible or missing data to make that assessment. The missing data fields are aggregated and the "most missed one" will be presented to the user as question next. In that way we ensure the most effective path from an empty profile to having all the answers for any particular user. The questionnaire ends, when no more requirement profile flags missing data points.

---

:tv: The first part of video 2 and the middle part of video 3 in [this demo series](https://youtube.com/playlist?list=PLqnwgqv0hgr5XX7cui8KeycLc5nL1Ixk9) are showing parts of the matching engine logic.

- **Input**: user profile, requirement profiles, datafield definitions, materialization rules
- **Output**: a report about eligibilities (yes, no, missing data), prioritized missing data fields and constraint violations


## Local development

```shell
npm install
npm test
# example for running a specific test:
npm test -- --grep "full matching"

# after bumping the version
npm publish
```

## Usage

```shell
npm install --save @foerderfunke/matching-engine

import { ValidationResult } from "@foerderfunke/matching-engine"
```

## Assumptions about requirement profiles this engine makes

- Every requirement profile must start with the triple: `<rpUri> a ff:RequirementProfile`
- Mandatory: `<rpUri> ff:hasMainShape` points to one main shape
- Optional: `<rpUri> ff:hasFlowShape` points to decision tree logic
- Multiple `sh:NodeShape`s are allowed (e.g. for `ff:Citizen` and `ff:Child`), but not for the same `sh:targetClass`. The only exception is for the shapes that `ff:hasMainShape` and `ff:hasFlowShape` point to
- If a `sh:node` or `sh:qualifiedValueShape` are pointing to another `sh:NodeShape`, that shape must have a `sh:targetClass`
- Every `sh:PropertyShape` must have `sh:minCount 1` (higher values are allowed), otherwise we can't recognize if that datapoint is missing
