import ws from "ws"

const client = new ws("ws://localhost:3001?id=terminal&webclient=false");

client.on("open", () => {
  const data = {
    "remoteControl": {
      "movie": "sachaS01E03.mp4",
      // "action": "play",
    },
    "targetIds": [ "desktop", "computer" ],
  }
  client.send(JSON.stringify(data));
  client.close()
});

client.on("close", (code, reason) => {
  if (code !== 1005) {
    console.log("closed because of " + reason + "(" + code + ")")
  }
})
