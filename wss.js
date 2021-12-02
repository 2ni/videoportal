import WebSocket, { WebSocketServer } from "ws"
import url from "url"
// import { v4 as uuid } from "uuid"

import { timestamp } from "./helpers/utils.js"

// we track clients on our own list
// maxPayload in bytes
const wss = new WebSocketServer({ noServer: true, clientTracking: false, maxPayload: 500 })

const monitorsTable = new Map()       // id: wss
const remoteControlsTable = new Map() // id: wss
const roomsTable = new Map()          // id(monitorId) => id:{id, type, movie, status(play,stop)}
const roomsMeta = new Map()           // id(monitorId) => {movie:"", status:""}

const debugTables = () => {
  console.log("")
  console.log(timestamp(), "*********** TABLES ***********")
  console.log(timestamp(), "monitors", Array.from(monitorsTable.keys()))
  console.log(timestamp(), "remotecontrols", Array.from(remoteControlsTable.keys()))
  console.log(timestamp(), "rooms")
  roomsTable.forEach((room,key) => {
    process.stdout.write(timestamp() + "  " + key + ": ")
    const participants = []
    room.forEach((p, k) => {
      participants.push(k + "(" + p.type + ")")
    })
    console.log(participants)
  })
  console.log(timestamp(), "roomsmeta")
  roomsMeta.forEach((meta,key) => {
    process.stdout.write(timestamp() + "  " + key + ": ")
    console.log(meta)
  })
  console.log(timestamp(), "******************************")
}


wss.on("exit", () => {
  /*
  console.log(timestamp(), "remove all clients")
  clientsTable.forEach(client => {
    client.send(JSON.stringify({ clients: { removeall: 1 }}))
    console.log(client.id)
  })
  */
})

wss.on("connection", (ws, req) => {
  // TODO https://github.com/websockets/ws/issues/617
  const broadcast = (whichType, roomId, data, excludeIds = []) => {
    let table = null
    switch (whichType) {
      case "monitor":
        table = monitorsTable
        break
      case "remotecontrol":
        table = remoteControlsTable
        break
      case "room":
        table = roomsTable
        break
    }
    if (table && whichType === "room") {
      table = table.get(roomId)
    }
    if (table) {
      data = typeof(data) !== "string" ? JSON.stringify(data) : data
      console.log(timestamp(), "broadcast to \"" + whichType + "(" + (roomId ? roomId : "") + ")\" from " + ws.id + ":  " + data)
      table.forEach(t => {
        let to = t
        if (whichType === "room") {
          if (t.type === "remotecontrol") to = remoteControlsTable.get(t.id)
          else if (t.type === "monitor") to = monitorsTable.get(t.id)
          else to = null
        }
        if (!excludeIds.includes(to.id) && to.id !== ws.id && to.readyState === WebSocket.OPEN) {
          console.log(timestamp(), "  > " + to.id)
          to.send(data)
        } else {
          console.log(timestamp(), "  > " + to.id + " (skipped)")
        }
      })
    }
  }

  const sendRoomList = (roomId) => {
    console.log(timestamp(), "send room list \"" + roomId + "\” to \"" + ws.id + "\"")
    const participants = []
    const room = roomsTable.get(roomId)
    if (room) {
      room.forEach(participant => {
        participants.push({ id: participant.id, type: participant.type })
      })
      if (participants.length) {
        const meta = roomsMeta.get(roomId) || {}
        ws.send(JSON.stringify({ reason: "participantlist", ...{ participants: participants }, ...{ meta: meta } }))
      }
    }
  }

  // if (!isValidToken(token)) return req.reject() or req.accept()
  // ws.uid = uuid()
  const parameters = url.parse(req.url, true)
  const clientType = parameters.query.clientType
  const roomId = parameters.query.roomId
  const clientId = parameters.query.id

  if (clientType === "monitor" && !roomId) {
    console.log(timestamp(), "invalid monitor")
    return ws.close(4001, "invalid monitor")
  }

  if (clientType === "remotecontrol" && !clientId) {
    console.log(timestamp(), "invalid remotecontrol")
    return ws.close(4001, "invalid remotecontrol")
  }

  if ((clientType === "remotecontrol" && remoteControlsTable.get(clientId))
    || (clientType === "monitor" && monitorsTable.get(clientId))) {
      console.log(timestamp(), "clientid taken")
      return ws.close(4001, "clientid taken")
  }

  if (!["remotecontrol", "monitor"].includes(clientType)) {
    console.log(timestamp(), "invalid client type")
    return ws.close(4001, "invalid client type")
  }

  console.log(timestamp(), clientType + " \"" + clientId + "\" connected ")
  ws.id = clientId
  ws.type = clientType

  // add client to table
  switch (clientType) {
    case "remotecontrol":
      remoteControlsTable.set(clientId, ws)
      // broadcast to all monitors about new remoteControl
      broadcast("monitor", null, { reason: "connected", id: clientId, type: clientType })

      // send all monitors to new remoteControl
      const monitors = []
      monitorsTable.forEach(monitor =>  {
        monitors.push(monitor.id)
      })
      if (monitors.length) {
        ws.send(JSON.stringify({ reason: "monitorlist", monitors: monitors }))
      }
      break
    case "monitor":
      monitorsTable.set(clientId, ws)
      // broadcast to all remotecontrols about new monitor
      broadcast("remotecontrol", null, { reason: "connected", id: clientId, type: clientType })

      // unset meta if monitor joins
      if (roomsMeta.get(clientId)) {
        roomsMeta.set(clientId, { status: "moviestopped", movie: "" })
      }

      // send all remotecontrols listening to new monitor
      // TODO needed, nothing is done with it
      if (roomsTable.get(roomId)) {
        const remotecontrols = []
        roomsTable.get(roomId).forEach(participant => {
          if (participant.type === "remotecontrol") {
            remotecontrols.push(participant.id)
          }
        })
      }
      break
  }

  // set up chat (monitor) room
  let room = null
  if (roomId) {
    room = roomsTable.get(roomId)
    if (!room) {
      console.log(timestamp(), "create room \"" + roomId + "\"")
      roomsTable.set(roomId, new Map())
      roomsMeta.set(roomId, { status: "moviestopped", movie: "" })
    }
    room = roomsTable.get(roomId)
    // add client to room
    room.set(clientId, { id: clientId, type: clientType })
    console.log(timestamp(), "add \"" + clientId + "\" to room \"" + roomId + "(" + room.size + ")\"")

    // broadcast all room clients about new client
    broadcast("room", roomId, { reason: "joined", id: clientId, type: clientType })

    // send status & all room members to new client
    sendRoomList(roomId)
  }

  debugTables()


  ws.on("message", (data, isBinary) => {
    try {
      let roomId
      let dataToSend
      data = JSON.parse(data)
      console.log(timestamp(), "got data from " + ws.id + ": " + JSON.stringify(data))
      // participant switched room
      switch(data.reason) {
        case "changedroom":
          broadcast("room", data.roomIdLeft, { reason: "left", id: ws.id, type: ws.type })
          broadcast("room", data.roomIdJoined, { reason: "joined", id: ws.id, type: ws.type })
          sendRoomList(data.roomIdJoined)
          break
        case "changedclientid":
          if (data.roomId) {
            broadcast("room", data.roomId, { reason: "changedclientid", id: data.id, type: ws.type, sourceid: ws.id })
            room.set(data.id, { id: data.id, type: ws.type })
            room.delete(ws.id)
          }
          broadcast(data.type, null, { reason: "changeclientid", id: data.id, type: ws.type, sourceid: ws.id })
          ws.id = data.id
          break
        case "loadmovie":
        case "movieloaded":
        case "playstop":
        case "forward":
        case "rewind":
        case "movieplaying":
        case "moviestopped":
        case "movieplayingerror":
        case "remoteactivated":
          ({ roomId, ...dataToSend } = data)

          let meta = roomsMeta.get(roomId)
          if (["movieplaying", "moviestopped"].includes(data.reaon)) {
            meta.status = data.reason
            roomsMeta.set(roomId, meta)
          } else if (data.reason === "movieloaded") {
            meta.movie = data.movie
            roomsMeta.set(roomId, meta)
          }
          broadcast("room", roomId, { ...{ "source": { id: ws.id, type: ws.type} }, ...dataToSend })
          break
      }
    } catch (e) {
      console.log(timestamp(), "incoming parsing error", e)
    }
  })

  ws.on("close", event => {
    if (roomId) {
      room.delete(clientId)
      console.log(timestamp(), "remove \"" + clientId + "\" from room \"" + roomId + "(" + room.size + ")\"")
      if (!room.size) {
        console.log(timestamp(), "remove room \"" + roomId + "\"")
        roomsTable.delete(roomId)
        roomsMeta.delete(roomId)
      } else {
        // broadcast to all members of chat about leaving client
        broadcast("room", roomId, { reason: "left", id: clientId, type: clientType })
      }
    }
    switch(clientType) {
      case "remotecontrol":
        // broadcast to all monitors about leaving remoteControl
        broadcast("remotecontrol", null, { reason: "disconnected", id: clientId, type: clientType })
        remoteControlsTable.delete(clientId)
        break
      case "monitor":
        // broadcast to all remotecontrols about leaving monitor
        broadcast("monitor", null, { reason: "disconnected", id: clientId, type: clientType })
        monitorsTable.delete(clientId)
        break
    }
    debugTables()
  })
})

export default wss
