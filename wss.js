import { env, config } from "./config/app.js"
import WebSocket, { WebSocketServer } from "ws"
import url from "url"
// import { v4 as uuid } from "uuid"

import { timestamp } from "./helpers/utils.js"

// we track clients on our own list
// maxPayload in bytes
const wss = new WebSocketServer({ noServer: true, clientTracking: false, maxPayload: 500 })

const monitorsTable = new Map()       // id: wss
const remoteControlsTable = new Map() // id: wss
const roomsTable = new Map()          // id(monitorId) => id:{id, type}, id:{id, type}
const roomsMeta = new Map()           // id(monitorId) => {movie:"", status:"", hasmonitor: false, lastPlayed: json-string}
let dbgMode = true

const  DBG = (...args) => {
  let noTs = null
  let noNl = null
  let i = 0
  for (const arg of args) {
    if (typeof arg === "object" && (arg.noTs || arg.noNl)) {
      noTs = arg.noTs
      noNl = arg.noNl
      args.splice(i, 1)
    }
    i++
  }
  if (dbgMode) {
    const ts = noTs ? "" : timestamp()
    if (noNl) { process.stdout.write(ts + (noTs ? "" : " ") + args[0]) }
    else console.log(ts, ...args)
  }
}

const debugTables = (context, client) => {
  DBG("", { noTs: true })
  DBG("*********** TABLES (" + client.type + ":" + client.id + " " + context + ") ***********")
  DBG("monitors", Array.from(monitorsTable.keys()))
  DBG("remotecontrols", Array.from(remoteControlsTable.keys()))
  DBG("rooms")
  roomsTable.forEach((room,key) => {
    DBG("  " + key + ": ", { noNl: true })
    const participants = []
    room.forEach((p, k) => {
      participants.push(k + "/" + p.type)
    })
    DBG(participants, { noTs: true })
  })
  DBG("roomsmeta")
  roomsMeta.forEach((meta,key) => {
    DBG("  " + key + ": ", { noNl: true })
    DBG(meta, {noTs: true })
  })
  DBG("******************************\n")
}


wss.on("exit", () => {
  /*
  DBG("remove all clients")
  clientsTable.forEach(client => {
    client.send(JSON.stringify({ clients: { removeall: 1 }}))
    DBG(client.id)
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
      DBG("broadcast to " + (roomId ? "" : "\"") + whichType + ( roomId ? " \"" + roomId : "") + "\" from " + ws.id + ":  " + data)
      table.forEach(t => {
        let to = t
        if (whichType === "room") {
          if (t.type === "remotecontrol") to = remoteControlsTable.get(t.id)
          else if (t.type === "monitor") to = monitorsTable.get(t.id)
          else to = null
        }
        if (!excludeIds.includes(to.id) && to.id !== ws.id && to.readyState === WebSocket.OPEN) {
          DBG("  > " + to.id)
          to.send(data)
        } else {
          DBG("  > " + to.id + " (skipped)")
        }
      })
    }
  }

  const sendRoomList = (roomId) => {
    if (!roomId) return

    DBG("send room list \"" + roomId + "\" to \"" + ws.id + "\"")
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
  const lastPlayed = parameters.query.lastplayed
  if (parameters.query.dbg === "true") dbgMode = true
  else if (parameters.query.dbg === "false") dbgMode = false
  else dbgMode = env === "localhost"

  if (clientType === "monitor" && !roomId) {
    DBG("invalid monitor, no roomId")
    return ws.close(4001, "invalid monitor")
  }

  if (clientType === "remotecontrol" && !clientId) {
    DBG("invalid remotecontrol")
    return ws.close(4001, "invalid remotecontrol")
  }

  if ((clientType === "remotecontrol" && remoteControlsTable.get(clientId))
    || (clientType === "monitor" && monitorsTable.get(clientId))) {
      DBG("clientid taken: " + clientType + ":" + clientId)
      return ws.close(4001, "clientid taken")
  }

  if (!["remotecontrol", "monitor"].includes(clientType)) {
    DBG("invalid client type")
    return ws.close(4001, "invalid client type")
  }

  ws.id = clientId
  ws.type = clientType
  DBG(ws.type + " \"" + ws.id + "\" connected ")

  // new client connected
  switch (ws.type) {
    case "remotecontrol":
      remoteControlsTable.set(ws.id, ws)
      // broadcast to all monitors about new remoteControl
      broadcast("monitor", null, { reason: "connected", id: ws.id, type: ws.type })

      // send all rooms to new remoteControl
      const rooms = []
      roomsTable.forEach((room, id) =>  {
        rooms.push({ id: id, meta: roomsMeta.get(id) })
      })
      if (rooms.length) {
        ws.send(JSON.stringify({ reason: "roomlist", rooms: rooms }))
      }
      break
    case "monitor":
      monitorsTable.set(ws.id, ws)

      // unset meta if monitor joins
      let meta = roomsMeta.get(ws.id)
      if (meta) {
        meta = { ...meta, ...{ status: "moviestopped", hasmonitor: true, lastplayed: lastPlayed }}
        roomsMeta.set(ws.id, meta)
      }

      // send all remotecontrols listening to new room
      // TODO needed? nothing is done with it
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

  // set up room
  let room = null
  let reason = "roomchanged"
  if (roomId) {
    room = roomsTable.get(roomId)
    if (!room) {
      reason = "roomadded"
      DBG("create room \"" + roomId + "\"")
      roomsTable.set(roomId, new Map())
      const meta = { status: "moviestopped", movie: "", hasmonitor: ws.type === "monitor", lastplayed: lastPlayed }
      roomsMeta.set(roomId, meta)
      ws.send(JSON.stringify({ reason: "roomadded", id: roomId, meta: meta }))
    }
    room = roomsTable.get(roomId)
    // add client to room
    room.set(ws.id, { id: ws.id, type: ws.type })
    DBG("add \"" + ws.id + "\" to room \"" + roomId + "(" + room.size + ")\"")

    // broadcast all room clients about new client
    broadcast("room", roomId, { reason: "joined", id: ws.id, type: ws.type })

    // send status & all room members to new client
    sendRoomList(roomId)
  }

  // broadcast to all remotecontrols about new/changed room
  // we need to do this after rooms have been set up
  // if monitor joins -> meta.hasminitor = true
  // if remote joins with room -> roomId
  if (ws.type === "monitor") {
    broadcast("remotecontrol", null, { reason: reason, id: ws.id, meta: roomsMeta.get(ws.id) })
  }
  if (ws.type === "remotecontrol" && roomId) {
    broadcast("remotecontrol", null, { reason: reason, id: roomId, meta: roomsMeta.get(roomId) })
  }

  debugTables("connect", ws)


  ws.on("message", (data, isBinary) => {
    try {
      let roomId
      let dataToSend
      data = JSON.parse(data)
      DBG("got data from " + ws.id + ": " + JSON.stringify(data))
      // participant switched room
      switch(data.reason) {
        case "changedroom":
          let rt = null
          if (data.roomIdLeft) {
            broadcast("room", data.roomIdLeft, { reason: "left", id: ws.id, type: ws.type })
            rt = roomsTable.get(data.roomIdLeft)
            rt.delete(ws.id)
          }

          if (data.roomIdJoined) {
            broadcast("room", data.roomIdJoined, { reason: "joined", id: ws.id, type: ws.type })
            sendRoomList(data.roomIdJoined)
            rt = roomsTable.get(data.roomIdJoined)
            rt.set(ws.id, { id: ws.id, type: ws.type })
          }
          break
        case "changedclientid":
          if (data.roomId) {
            broadcast("room", data.roomId, { reason: "changedclientid", id: data.id, type: ws.type, sourceid: ws.id, meta: roomsMeta.get(ws.id) })
            // add new name to room, remove old one
            room.set(data.id, { id: data.id, type: ws.type })
            room.delete(ws.id)

            // add participants from potential new name room to old room before renaming it
            const existinstingParticipants = roomsTable.get(data.id)
            DBG("existinstingParticipants: " + existinstingParticipants, { noTs: true })
            if (existinstingParticipants) {
              existinstingParticipants.forEach((existinstingParticipant, k) => {
                if (!room.get(k)) {
                  room.set(k, existinstingParticipant)
                }
              })
            }
          }
          switch(data.type) {
            case "monitor":
              roomsTable.set(data.id, roomsTable.get(ws.id))
              roomsTable.delete(ws.id)
              monitorsTable.set(data.id, monitorsTable.get(ws.id))
              monitorsTable.delete(ws.id)
              roomsMeta.set(data.id, roomsMeta.get(ws.id))
              roomsMeta.delete(ws.id)
              DBG("renamed room " + ws.id + " => " + data.id)

              broadcast("remotecontrol", null, { reason: "changedclientid", id: data.id, type: ws.type, sourceid: ws.id, x: 2 })
              break
            case "remotecontrol":
              remoteControlsTable.set(data.id, remoteControlsTable.get(ws.id))
              remoteControlsTable.delete(ws.id)
              break
          }
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
          } else if (data.reason === "movieloaded" || data.reason === "loadmovie") {
            meta.movie = data.movie
            roomsMeta.set(roomId, meta)
          }
          broadcast("room", roomId, { ...{ "source": { id: ws.id, type: ws.type} }, ...dataToSend })
          break
      }
    } catch (e) {
      DBG("incoming parsing error", e)
    }

    debugTables("message", ws)
  })

  ws.on("close", event => {
    switch (ws.type) {
      case "monitor":
        room.delete(ws.id)
        DBG("remove \"" + ws.id + "\" from room \"" + ws.id + "(" + (room.size || 0) + ")\"")
        let meta = roomsMeta.get(ws.id)
        meta.hasmonitor = false
        meta.lastplayed = ""
        roomsMeta.set(ws.id, meta) // hasmonitor: false assumes we only have 1 monitor per room
        broadcast("room", ws.id, { reason: "left", id: ws.id, type: ws.type })
        // keep room as long as participants
        let reason = "roomchanged"
        if (!room.size) {
          reason = "roomdeleted"
          DBG("remove room \"" + ws.id + "\"")
          roomsTable.delete(ws.id)
          roomsMeta.delete(ws.id)
        }
        broadcast("remotecontrol", null, { reason: reason, id: ws.id, meta: meta })
        monitorsTable.delete(ws.id)

        break
      case "remotecontrol":
        // inform any room about leaving remotecontrol and delete
        // TODO for now we iterate through all rooms
        roomsTable.forEach( (r, id) => {
          if (r.get(ws.id)) {
            r.delete(ws.id)
            DBG("remove \"" + ws.id + "\" from room \"" + ws.id + "(" + (r.size || 0) + ")\"")
            broadcast("room", id, { reason: "left", id: ws.id, type: ws.type })
            if (!r.size) {
              DBG("remove room \"" + id + "\"")
              roomsTable.delete(id)
              roomsMeta.delete(id)
            }
          }
        })

        remoteControlsTable.delete(ws.id)
        break
    }

    debugTables("disconnect", ws)
  })
})

export default wss
