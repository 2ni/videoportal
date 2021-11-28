import WebSocket, { WebSocketServer } from "ws"
import url from "url"
// import { v4 as uuid } from "uuid"

import { timestamp } from "./helpers/utils.js"

// we track clients on our own list
// maxPayload in bytes
const wss = new WebSocketServer({ noServer: true, clientTracking: false, maxPayload: 500 })

const clientsTable = new Map()

wss.on("exit", () => {
  console.log(timestamp(), "remove all clients")
  clientsTable.forEach(client => {
    client.send(JSON.stringify({ clients: { removeall: 1 }}))
    console.log(client.id)
  })
})

wss.on("connection", (ws, req) => {
  // if (!isValidToken(token)) return req.reject() or req.accept()
  // ws.uid = uuid()
  // console.log("connecting", ws.uid)
  const parameters = url.parse(req.url, true)
  ws.id = parameters.query.id
  if (!ws.id) {
    console.log(timestamp(), "client connecting lacks id")
    return ws.close(4001, "missing id")
  }

  ws.webclient = !parameters.query.webclient || parameters.query.webclient !== "false"
  clientsTable.set(ws.id, ws)
  console.log(timestamp(), "client connected " + ws.id + " (" + clientsTable.size + ")")

  // TODO https://github.com/websockets/ws/issues/617
  const broadcast = (data, skipSource = true) => {
    data = typeof(data) !== "string" ? JSON.stringify(data) : data
    console.log(timestamp(), "broadcasting from " + ws.id + ":  " + data)
    clientsTable.forEach(client => {
      if (skipSource && client !== ws && client.readyState === WebSocket.OPEN) {
        console.log(timestamp(), "  > " + client.id)
        client.send(data)
      }
    })
  }

  if (ws.webclient) {
    // send new client to all existing clients
    const clients = []
    clientsTable.forEach(client => { clients.push(client.id) })

    broadcast({ clients: { add: [ ws.id ], list: clients } })

    // send all available clients to the new client
    if (clients.length > 1) {
      console.log(timestamp(), "initial clientList to " + ws.id, clients)
      ws.send(JSON.stringify({ clients: { list: clients } }))
    }
  }

  // TODO only accept specific messages
  ws.on("message", (data, isBinary) => {
    try {
      data = JSON.parse(data)
      console.log(timestamp(), "got data from " + ws.id + ": " + JSON.stringify(data))
      if (data.targetIds) {
        for (const targetId of data.targetIds) {
          const dest = clientsTable.get(targetId)
          if (dest) {
            console.log(timestamp(), "  " + ws.id + " => " + dest.id)
            dest.send(JSON.stringify({...{"sourceId": ws.id}, ...data}))
          } else {
            console.log(timestamp(), "  " + ws.id + " => " + targetId + " (skipped)")
          }
        }
      } else {
        broadcast(data)
      }
    } catch (e) {
      console.log(timestamp(), "incoming parsing error", e)
    }
  })

  ws.on("close", event => {
    clientsTable.delete(ws.id)
    const clients = []
    clientsTable.forEach(client => { clients.push(client.id) })

    console.log(timestamp(), "client disconnected " + ws.id + " (" + clientsTable.size + ")")
    if (ws.webclient) {
      broadcast(JSON.stringify({ clients: { remove: [ ws.id ], list: clients } }))
    }
  })
})

export default wss
