# **MikroORM Schema Evolution Bug(?) (v5 vs. v6)**

## **Overview**
This repository demonstrates a **breaking change in MikroORM v6** when handling **legacy MongoDB documents** that predate a schema migration.

In **MikroORM v5**, if a collection field (e.g., a `@ManyToMany` relation) is **missing** in some documents, calling `.init()` on the relation **does not throw**—it simply returns an empty collection.

In **MikroORM v6**, calling `.init()` on an uninitialized collection **throws an error** if the document does not contain the expected relation field.

## **Reproduction Setup**
This repo contains two projects:
- 📂 **`/mikroormversion5/`** → Uses **MikroORM v5.1.1**  
- 📂 **`/mikroormversion6/`** → Uses **MikroORM v6.x**  

Each project has its own `package.json` and dependencies.

## **Steps to Reproduce**
1. Clone the repository and install dependencies in both projects:
   ```sh
   git clone <repo-url>
   cd mikroormversion5 && npm install
   cd ../mikroormversion6 && npm install
   ```
2. Run the **test in v5** (✅ Should pass):
   ```sh
   cd ../mikroormversion5
   npm run start
   ```
3. Run the **test in v6** (❌ Throws error for legacy documents):
   ```sh
   cd ../mikroormversion6
   npm run start
   ```

## **Test Case Explanation**
- The test simulates **schema evolution** by:
  1. Creating **"legacy"** documents in MongoDB using an **old schema** (no `flowers` field).
  2. Closing the ORM and re-initializing it with a **new schema** that adds a `@ManyToMany` relation.
  3. Fetching **all** documents (both old & new).
  4. Calling `.init()` on the `flowers` collection.
  5. **Expected:** Old documents return `[]` without errors.  
     **Actual (MikroORM v6):** Throws `Collection<Flower> ... not initialized` error.

## **Expected vs. Actual Behavior**
| MikroORM Version | Behavior |
|------------------|----------|
| **v5** ✅ | `pot.flowers.init()` works fine for old documents (returns `[]`). |
| **v6** ❌ | `pot.flowers.init()` **throws** if the `flowers` field is missing. |

## **Questions for MikroORM Maintainers**
1. **Is this an intended change in v6?**
2. **If so, what is the recommended migration strategy** for handling old documents missing relational fields?
3. **Is there a way to restore v5 behavior** (treat missing collections as empty rather than uninitialized)?

