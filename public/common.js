let ws = null
let trial = 0

const _startWebsocket = (id, clientType) => {
  if (id) {
    let dbg = new URLSearchParams(window.location.search).get("dbg")
    dbg = (dbg && dbg.match(/^(true|false)$/)) ? dbg : null
    console.log("dbg", dbg)
    const wscmd = "ws"
      + (window.location.protocol === "https" ? "s" : "")
      + "://" + window.location.hostname + (window.location.port ? ":" : "") + window.location.port
      + "?id=" + id + "&clientType=" + clientType + "&roomId=" + monitorId
      + (dbg !== null ? "&dbg=" + dbg: "")
    console.log("opening websocket", wscmd)

    ws = new WebSocket(wscmd)
    ws.onopen = () => {
      console.log("connection opened", id)
      trial = 0
    }

    ws.onmessage = ({ data }) => {
      try {
        data = JSON.parse(data)
      } catch (e) {
        data = {}
      }
      // console.log("data from server", data)
      const { reason, ...dataEvt } = data
      const eventsAllowed = [ "monitorlist", "participantlist", "connected", "disconnected", "joined", "left", "changedclientid", "loadmovie", "movieloaded", "playstop", "forward", "rewind", "movieplaying", "moviestopped", "movieplayingerror", "remoteactivated", "roomadded", "roomdeleted", "roomchanged", "roomlist" ]
      if (eventsAllowed.includes(data.reason)) {
        console.log("evt-" + data.reason, dataEvt)
        document.dispatchEvent(new CustomEvent("evt-" + data.reason, { detail: dataEvt }))
      } else {
        console.log("event not allowed", data.reason, dataEvt)
      }




      // received command from remote control, eg start, stop, load movie
      if (data.remoteControl) {
        const custEvt = new CustomEvent("remoteControl", { "detail": { ...{ "sourceId": data.sourceId}, ...data.remoteControl }})
        document.querySelector("#video-holder video").dispatchEvent(custEvt)
      }
    }

    ws.onclose = event => {
      console.log("connection closed", trial)
      trial++
      ws = null
      setTimeout(_startWebsocket.bind(null, id, clientType), trial < 3 ? 300 : 5000)
    }
  }
}

const generateBime = ({ length } = { length: 5 }) => {
  const consonants = ["b", "c", "d", "f", "g", "h", "k", "p", "q", "r", "s", "t", "v", "w"]
  const vowels = ["a", "e", "i", "o", "u"]
  const blacklist = []

  const letters = []
  for (let index = 0; index < length; index++) {
    const list = (index % 2) ? vowels : consonants
    const letter = list[ Math.floor(Math.random() * list.length) ]
    letters.push(letter)
  }
  const bime = letters.join("")
  for (const badWord of blacklist) if (bime.indexOf(badWord) > -1) return generateBime({ length })
  return bime
}

const handleWebsocket = (clientControlElm) => {
  if (!clientControlElm) return

  const clientIdElm = clientControlElm.querySelector("#client-id input")
  const isRemoteControl = typeof remoteId !== "undefined"
  let clientId = (isRemoteControl && remoteId)
    || (typeof monitorId !== "undefined" && monitorId)
    || window.localStorage.getItem("client-id")
    || generateBime({ length: 7 })

  if (!isRemoteControl && !monitorId) {
    monitorId = clientId
  }

  if (!clientControlElm && !monitorId && window.localStorage.getItem("client-id") !== clientId) {
    window.localStorage.setItem("client-id", clientId)
  }

  _startWebsocket(clientId, isRemoteControl ? "remotecontrol" : "monitor")
  clientIdElm.setAttribute("value", clientId)

  clientIdElm.addEventListener("keydown", event => {
    // id switched
    if (event.code === "Enter" || event.key === "Enter") {
      event.target.blur()
      const id = event.target.value
      if (id !== clientId) {
        window.localStorage.setItem("client-id", id)
        if (!isRemoteControl) monitorId = id
        ws.send(JSON.stringify({ reason: "changedclientid", id: id, type: isRemoteControl ? "remotecontrol": "monitor", roomId: monitorId }))
        clientId = id
      }
    }
  })
}
