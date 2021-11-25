import WebSocket, { WebSocketServer } from "ws"
import url from "url"
import { timestamp } from "./helpers/utils.js"

const wss = new WebSocketServer({ noServer: true })

wss.on("connection", (ws, req) => {
  // if (!isValidToken(token)) return req.reject() or req.accept()
  // ws.uid = uuid()
  // console.log("connecting", ws.uid)
  const parameters = url.parse(req.url, true)
  ws.id = parameters.query.id
  console.log(timestamp(), "client connected", ws.id)

  const dispatchAll = (data) => {
    wss.clients.forEach(client => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(data)
      }
    })
  }

  // send all available clients to the new client
  // send new client to all existing clients
  const clients = []
  wss.clients.forEach(client => {
    if (client !== ws) {
      clients.push(client.id)
      client.send(JSON.stringify({ clients: {"list": [ws.id] } }))
    }
  })
  if (clients.length) {
    console.log(timestamp(), "sending initial client list to " + ws.id, clients)
    ws.send(JSON.stringify({ clients: { "list": clients } }))
  }

  ws.on("message", (data, isBinary) => {
    dispatchAll(data);
  })

  ws.on("close", event => {
    console.log(timestamp(), "client disconnected", ws.id, event)
    dispatchAll(JSON.stringify({ clients: {"remove": [ws.id] } }))
  })
})

export default wss
