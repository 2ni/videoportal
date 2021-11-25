import ws from "ws"

const client = new ws("ws://localhost:3001");

client.on("open", () => {
  const data = {
    "msg": "Hello"
  }
  client.send(JSON.stringify(data));
});
