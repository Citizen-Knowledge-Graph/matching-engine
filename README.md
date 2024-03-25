# matching-engine
- **Input**: user profile, requirement profiles, datafield constraints, materialization queries
- **Output**: a report about eligibilities (yes, no, missing data)

In use in the [foerderfunke-app](https://github.com/Citizen-Knowledge-Graph/foerderfunke-app).

## Developing this library

```shell
# to build the distributions
npm run build
# to run dev.js
npm start
```

## Using this library as dependency

```shell
npm install --save @foerderfunke/matching-engine
```

### require

```shell
# package.json
{
  "dependencies": {
    "@foerderfunke/matching-engine": "^0.2.0"
  }
}

# dev.js
const { func } = require("@foerderfunke/matching-engine")
func()

# node dev.js
```

### import

```shell
# package.json
{
  "type": "module",
  "dependencies": {
    "@foerderfunke/matching-engine": "^0.2.0"
  }
}

# dev.js
import { func } from "@foerderfunke/matching-engine"
func()

# node dev.js
```

### in the browser

```shell
# dev.html
<!DOCTYPE html>
<html>
<body>
    <script src="node_modules/@foerderfunke/matching-engine/dist/bundle.umd.js"></script>
    <script>
        MatchingEngine.func();
    </script>
</body>
</html>
```
