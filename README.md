# matching-engine

:tv: The first part of video 2 and the middle part of video 3 in [this demo series](https://youtube.com/playlist?list=PLqnwgqv0hgr5XX7cui8KeycLc5nL1Ixk9) are showing parts of the matching engine logic.

- **Input**: user profile, requirement profiles, datafield definitions, materialization rules
- **Output**: a report about eligibilities (yes, no, missing data), prioritized missing data fields and constraint violations

In use in the [FörderFunke Web App](https://github.com/Citizen-Knowledge-Graph/foerderfunke-react-app).

## Local development

```shell
npm install
npm test

# after bumping the version
npm publish
```

## Usage

```shell
npm install --save @foerderfunke/matching-engine

import { ValidationResult } from "@foerderfunke/matching-engine"
```
