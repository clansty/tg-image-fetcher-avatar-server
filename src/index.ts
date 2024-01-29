import { Api, TelegramClient } from "telegram"
import { configure, getLogger } from 'log4js';
import TelegramSession from "./models/TelegramSession";
import Express from "express";

(async () => {
  configure({
    appenders: {
      console: { type: 'console' },
    },
    categories: {
      default: { level: 'debug', appenders: ['console'] },
    },
  });
  const log = getLogger('Main');
  process.on('unhandledRejection', error => {
    log.error('UnhandledException: ', error);
  });

  const telegram = new TelegramClient(new TelegramSession(), Number(process.env.API_ID), process.env.API_HASH, {});
  await telegram.start({
    botAuthToken: process.env.BOT_TOKEN,
  });

  const app = Express();

  app.get("/avatar/:userId", async (req, res) => {
    try {
      const photo = await telegram.downloadProfilePhoto(req.params.userId, { isBig: true });
      if (!photo) {
        res.status(404).end();
        return;
      }
      res.type("jpeg").end(photo);
    }
    catch (e) {
      log.warn(e);
      res.status(404).end();
    }
  })

  app.listen(8000, () => {
    log.info("Listening on 8000");
  })
})()
