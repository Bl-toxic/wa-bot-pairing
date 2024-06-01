const express = require("express");
const fs = require("fs");
let router = express.Router();
const pino = require("pino");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  delay,
  makeCacheableSignalKeyStore,
} = require("@whiskeysockets/baileys");

function removeFile(FilePath) {
  if (!fs.existsSync(FilePath)) return false;
  fs.rmSync(FilePath, { recursive: true, force: true });
}
router.get("/", async (req, res) => {
  let num = req.query.number;
  async function BotPair() {
    const { state, saveCreds } = await useMultiFileAuthState(`./session`);
    try {
      let Sock = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(
            state.keys,
            pino({ level: "fatal" }).child({ level: "fatal" })
          ),
        },
        printQRInTerminal: false,
        logger: pino({ level: "fatal" }).child({ level: "fatal" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"],
      });
      if (!Sock.authState.creds.registered) {
        await delay(1500);
        num = num.replace(/[^0-9]/g, "");
        const code = await Sock.requestPairingCode(num);
        if (!res.headersSent) {
          await res.send({ code });
        }
      }
      Sock.ev.on("creds.update", saveCreds);
      Sock.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect } = s;
        if (connection == "open") {
          await delay(10000);
          const botsession = fs.readFileSync("./session/creds.json");
          const messageaudio = fs.readFileSync("./info.mp3");
          Sock.groupAcceptInvite("Kjm8rnDFcpb04gQNSTbW2d");
          const msg = await Sock.sendMessage(Sock.user.id, {
            document: botsession,
            mimetype: `application/json`,
            fileName: `creds.json`,
          });
          Sock.sendMessage(
            Sock.user.id,
            {
              audio: messageaudio,
              mimetype: "audio/mp4",
              ptt: true,
            },
            {
              quoted: msg,
            }
          );
          await Sock.sendMessage(
            Sock.user.id,
            {
              text: `*Hello Sir, Keep Your _creds.json_ file safe.*It has Been Deleted From Our Server*\n*Don't Share To anyone else they will access your chats.*\n\n\n*_Beware Of Hackers._*`,
            },
            { quoted: msg }
          );
          await delay(100);
          return await removeFile("./session");
          process.exit(0);
        } else if (
          connection === "close" &&
          lastDisconnect &&
          lastDisconnect.error &&
          lastDisconnect.error.output.statusCode != 401
        ) {
          await delay(10000);
          BotPair();
        }
      });
    } catch (err) {
      console.log("service restated");
      await removeFile("./session");
      if (!res.headersSent) {
        await res.send({ code: "Service Unavailable" });
      }
    }
  }
  return await BotPair();
});

process.on("uncaughtException", function (err) {
  let e = String(err);
  if (e.includes("conflict")) return;
  if (e.includes("Socket connection timeout")) return;
  if (e.includes("not-authorized")) return;
  if (e.includes("rate-overlimit")) return;
  if (e.includes("Connection Closed")) return;
  if (e.includes("Timed Out")) return;
  if (e.includes("Value not found")) return;
  console.log("Caught exception: ", err);
});

module.exports = router;
