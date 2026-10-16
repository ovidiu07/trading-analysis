import { copyFileSync } from 'node:fs'
// Edit only the backend resource. The checked-in generated copy also supports standalone frontend builds.
copyFileSync(new URL('../../backend/src/main/resources/backtesting/ict-fields.json', import.meta.url),
  new URL('../src/features/backtesting/ict-fields.generated.json', import.meta.url))
