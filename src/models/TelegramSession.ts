import { MemorySession } from "telegram/sessions/index.js";
import db from "./db.js";
import { AuthKey } from "telegram/crypto/AuthKey.js";
import log4js from "log4js";

const PASS = () => 0;

export default class TelegramSession extends MemorySession {
  private log: log4js.Logger;
  private _dbId: number;

  constructor() {
    super();
    this.log = log4js.getLogger(`TelegramSession`);
  }

  async load() {
    this.log.trace("load");
    const dbEntry = await db.session.findFirst({
      include: { entities: true },
    });

    if (!dbEntry) {
      this.log.debug("Session 不存在，创建");
      // 创建并返回
      const newDbEntry = await db.session.create({ data: {} });
      this._dbId = newDbEntry.id;
      return;
    }

    const { authKey, dcId, port, serverAddress } = dbEntry;
    this._dbId = dbEntry.id;

    if (authKey && typeof authKey === "object") {
      this._authKey = new AuthKey();
      await this._authKey.setKey(authKey);
    }
    if (dcId) {
      this._dcId = dcId;
    }
    if (port) {
      this._port = port;
    }
    if (serverAddress) {
      this._serverAddress = serverAddress;
    }

    // id, hash, username, phone, name
    this._entities = new Set(dbEntry.entities.map((e) => [e.entityId, e.hash, e.username, e.phone, e.name]));
  }

  setDC(dcId: number, serverAddress: string, port: number) {
    this.log.trace("setDC", dcId, serverAddress, port);
    super.setDC(dcId, serverAddress, port);
    db.session
      .update({
        where: { id: this._dbId },
        data: { dcId, serverAddress, port },
      })
      .then((e) => this.log.trace("DC update result", e))
      .catch(PASS);
  }

  set authKey(value: AuthKey | undefined) {
    this.log.trace("authKey", value);
    this._authKey = value;
    db.session
      .update({
        where: { id: this._dbId },
        data: { authKey: value?.getKey() || null },
      })
      .then((e) => this.log.trace("authKey update result", e))
      .catch(PASS);
  }

  get authKey() {
    return this._authKey;
  }

  processEntities(tlo: any) {
    this.log.trace("processEntities");
    const entitiesSet = this._entitiesToRows(tlo);
    for (const e of entitiesSet) {
      this.log.trace("processEntity", e);
      this._entities.add(e);
      db.entity
        .upsert({
          // id, hash, username, phone, name
          where: {
            entityId: e[0].toString(),
          },
          create: {
            sessionId: this._dbId,
            entityId: e[0] && e[0].toString(),
            hash: e[1] && e[1].toString(),
            username: e[2] && e[2].toString(),
            phone: e[3] && e[3].toString(),
            name: e[4] && e[4].toString(),
          },
          update: {
            hash: e[1] && e[1].toString(),
            username: e[2] && e[2].toString(),
            phone: e[3] && e[3].toString(),
            name: e[4] && e[4].toString(),
          },
        })
        .then((e) => this.log.trace("Entity update result", e))
        .catch(PASS);
    }
  }
}
