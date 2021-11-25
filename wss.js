import WebSocket, { WebSocketServer } from "ws"
import url from "url"
// import { v4 as uuid } from "uuid"

import { timestamp } from "./helpers/utils.js"

const wss = new WebSocketServer({ noServer: true })

const clientsTable = new Map()

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

  const broadcast = (data) => {
    data = typeof(data) !== "string" ? JSON.stringify(data) : data
    wss.clients.forEach(client => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(data)
      }
    })
  }

  if (ws.webclient) {
    // send new client to all existing clients
    const clients = []
    wss.clients.forEach(client => {
      if (client !== ws) {
        clients.push(client.id)
        client.send(JSON.stringify({ clients: {"list": [ ws.id ] } }))
      }
    })

    // send all available clients to the new client
    if (clients.length) {
      console.log(timestamp(), "sending initial client list to " + ws.id, clients)
      ws.send(JSON.stringify({ clients: { "list": clients } }))
    }
  }

  ws.on("message", (data, isBinary) => {
    try {
      data = JSON.parse(data)
      console.log(timestamp(), "got data from a client", data)
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
        console.log(timestamp(), "broadcast data from " + ws.id)
        broadcast(data)
      }
    } catch (e) {
      console.log(timestamp(), "incoming parsing error", e)
    }
  })

  ws.on("close", event => {
    clientsTable.delete(ws.id)
    console.log(timestamp(), "client disconnected " + ws.id + " (" + clientsTable.size + ")")
    if (ws.webclient) {
      broadcast(JSON.stringify({ clients: {"remove": [ ws.id ] } }))
    }
  })
})

export default wss
