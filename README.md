# matching-engine

:tv: The first part of video 2 and the middle part of video 3 in [this demo series](https://youtube.com/playlist?list=PLqnwgqv0hgr5XX7cui8KeycLc5nL1Ixk9) are showing parts of the matching engine logic.

- **Input**: user profile, requirement profiles, datafield definitions, materialization rules
- **Output**: a report about eligibilities (yes, no, missing data) and prioritized missing data fields

In use in the [FörderFunke Web App](https://github.com/Citizen-Knowledge-Graph/foerderfunke-react-app).

## Local development

```shell
# to run dev.js
npm start

# after bumping the version
npm run build
npm publish
```

## Using this library as dependency

```shell
npm install --save @foerderfunke/matching-engine

import { ValidationResult } from "@foerderfunke/matching-engine"
```
or:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>dev</title>
</head>
<body>
    <script src="./dist/bundle.js"></script>
    <script>
        MatchingEngine.validateAll() // ...
    </script>
</body>
</html>
```
