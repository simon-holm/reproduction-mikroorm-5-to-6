import {
  Entity,
  MikroORM,
  PrimaryKey,
  Property,
  ManyToMany,
  Collection,
  wrap,
} from "@mikro-orm/core";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoDriver } from "@mikro-orm/mongodb";

let orm: MikroORM;
let mongoServer: MongoMemoryServer;

describe("MongoDB Schema Evolution (Old -> New) in MikroORM v6", () => {

  it("should load old documents (missing relation fields) under the new schema without throwing errors", async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();

    @Entity()
    class Pot {
      @PrimaryKey()
      _id!: number;

      @Property()
      name!: string;

      // Old schema: No "flowers" relation
      constructor(name: string) {
        this.name = name;
      }
    }

    // 2) Init MikroORM with the OLD schema
    const oldOrm = await MikroORM.init({
      driver: MongoDriver,
      clientUrl: uri,
      dbName: "migration_test",
      entities: [Pot],
      allowGlobalContext: true,
      debug: ["query", "query-params"],
    });

    {
      const em = oldOrm.em.fork();
      const oldPot1 = new Pot("LegacyPot1");
      const oldPot2 = new Pot("LegacyPot2");
      em.persist([oldPot1, oldPot2]);
      await em.flush();
    }

    await oldOrm.close(true);

    // new blockscope as to "override" the entity definitions...
    {
      // New Schema - things change over time!
      @Entity()
      class Pot {
        @PrimaryKey()
        _id!: number;

        @Property()
        name!: string;

        // NEW RELATION
        @ManyToMany(() => Flower, undefined, { nullable: true })
        flowers = new Collection<Flower>(this);

        constructor(name: string) {
          this.name = name;
        }
      }

      @Entity()
      class Flower {
        @PrimaryKey()
        _id!: number;

        @Property()
        type!: string;

        constructor(type: string) {
          this.type = type;
        }
      }

      const newOrm = await MikroORM.init({
        driver: MongoDriver,
        clientUrl: uri,
        dbName: "migration_test",
        entities: [Pot, Flower],
        allowGlobalContext: true,
        debug: ["query", "query-params"],
      });
      orm = newOrm

      {
        const em = newOrm.em.fork();
        const newPotWithoutFlowers = new Pot('NewPotWithoutFlowers')
        const potWithFlowers = new Pot("NewPot");
        const flowerA = new Flower("Rose");
        const flowerB = new Flower("Tulip");

        wrap(potWithFlowers).assign({ flowers: [flowerA, flowerB] }, { em });

        em.persist([newPotWithoutFlowers, potWithFlowers, flowerA, flowerB]);
        await em.flush();
      }

      // 7) attempt load *all* pots. both legacy pots and newer
      {
        const em = newOrm.em.fork();
        const allPots = await em.find(Pot, {});
        expect(allPots).toHaveLength(4);

        let itWorks = true
        for (const pot of allPots) {
          try {
            await pot.flowers.init();
            console.log(`Pot "${pot.name}" has ${pot.flowers.count()} flowers`);
          } catch (error) {
            console.error(`It does not work for ${pot.name}`, error)
            itWorks = false
          }
        }

        expect(itWorks).toBeTruthy()
      }

      // 9) Cleanup
      await newOrm.close(true);
      await mongoServer.stop();
    }
  });

  afterAll(async () => {
    if (orm) {
      await orm.close(true)
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });
});
