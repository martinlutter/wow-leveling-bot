---
name: add-dynamodb-storage
description: Add DynamoDB persistence to the bot (table, client, data-access functions, models). Use when a command or scheduled job needs to store state between invocations.
---

# Add DynamoDB storage

## First time only

1. `npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb`
2. `src/clients/db.ts`:

   ```ts
   import { DynamoDB } from '@aws-sdk/client-dynamodb';
   import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

   const client = new DynamoDB();
   export const db = DynamoDBDocument.from(client);
   ```

3. `app.config.ts`: one table with generic keys (single-table design). Imports: `RemovalPolicy` from `aws-cdk-lib`,
   `AttributeType`, `TableV2` from `aws-cdk-lib/aws-dynamodb`.

   ```ts
   const table = new TableV2(stack, 'Table', {
     partitionKey: { name: 'pk', type: AttributeType.STRING },
     sortKey: { name: 'sk', type: AttributeType.STRING },
     removalPolicy: RemovalPolicy.RETAIN, // DESTROY only if losing the data is fine
     timeToLiveAttribute: 'ttl',
   });
   table.grantReadWriteData(executeLambda); // plus any scheduled job lambdas, never the Interaction lambda
   ```

   Add `TABLE_NAME: table.tableName` to the `environment` of every lambda that uses it (not to `.env`; CDK supplies it).
   Don't set `tableName` explicitly: a generated name lets multiple stacks live in one account.

4. `src/db/constants.ts`: `export const tableName = process.env.TABLE_NAME!;`
5. `src/util/createAttributeNames.ts`, for typo-safe attribute names in expressions:

   ```ts
   export default function createAttributeNames<T extends object>() {
     return new Proxy({} as { [K in keyof T]: K }, {
       get: (_, prop: string) => prop,
     });
   }
   ```

## Per entity

- Design keys around the queries you need, not the domain shape. List the access patterns first
  (e.g. "all votes of week W" → `pk: vote2025W47`, `sk: <voterId>`).
- `src/db/model/<entity>.ts`:
  - domain interface `<Entity>` (what the rest of the code uses)
  - `Dynamo<Entity>` interface with `pk`/`sk`; comment the key format on each (`readonly pk: string; // vote{year}W{week}`)
  - `export const Dynamo<Entity>Keys = createAttributeNames<Dynamo<Entity>>();`
  - key builders `to<Entity>Pk(...)` / `to<Entity>Sk(...)`
  - mappers `map<Entity>ToDynamoItem` / `mapDynamoItemTo<Entity>`. Code outside `src/db` never sees Dynamo items.
- `src/db/<verbNoun>.ts`: one exported function per access pattern, using `db.get/put/update/query`, the key builders
  and `Dynamo<Entity>Keys` for `ExpressionAttributeNames`.
- TTL values are Unix **seconds** (`Math.floor(ms / 1000)`). Compute dates in UTC.

## Tests

- Data-access functions: mock the client and assert the exact request object:

  ```ts
  jest.mock('../../src/clients/db', () => ({ db: { put: jest.fn() } }));
  ```

- Model mappers and key builders are pure: test them directly, including round-trips.
- Commands that use storage: mock the `src/db/<verbNoun>` modules, not the client.

Finish with `npm run build && npm test && npm run lint && npx cdk synth`, then tell the user to `npm run deploy`.
