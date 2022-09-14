let ws = null
let trial = 0

// https://stackoverflow.com/questions/49916259/show-element-when-in-viewport-on-scroll
const loadVideos = () => {
  const innerHeight = window.innerHeight || document.documentElement.clientHeight
  document.querySelectorAll("video").forEach(el => {
    const bb = el.getBoundingClientRect()
    // if within viewport and not yet loaded
    if (el.preload !== "metadata" && !(bb.top > innerHeight || bb.bottom < 0)) {
      console.log(el.querySelector("source").src, !(bb.top > innerHeight || bb.bottom < 0))
      el.preload = "metadata"
    }
  })
}

document.addEventListener("DOMContentLoaded", event => {
  loadVideos()
})

document.addEventListener("scroll", event => {
  loadVideos()
})

const _startWebsocket = (id, clientType) => {
  if (id) {
    let dbg = new URLSearchParams(window.location.search).get("dbg")
    dbg = (dbg && dbg.match(/^(true|false)$/)) ? dbg : null
    const wscmd = "ws"
      + (window.location.protocol === "https" ? "s" : "")
      + "://" + window.location.hostname + (window.location.port ? ":" : "") + window.location.port
      + "?id=" + id + "&clientType=" + clientType + "&roomId=" + monitorId
      + "&lastplayed=" + JSON.stringify(new Fifo("lastPlayed").get())
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

const capitalize = (str) => {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

const prettifyMovie = (fn) => {
  return capitalize(fn.replace(/^.*?([^/]*)\.[^.]*$/, "$1"))
}

/*
 * make HEAD call to check if resource exists
 */
const urlExists = (url, callback) => {
  var http = new XMLHttpRequest()
  http.open('HEAD', url)
  http.onreadystatechange = function() {
    if (this.readyState == this.DONE && this.status !== 404) {
      callback()
    }
  }
  http.send()
}

/*
 *  simple fifo list
 *  new Fifo("somename").set("foo", "bar)
 *  new Fifo("somename").get("foo")
 */
const Fifo = class {
  constructor(name) {
    this.name = name
    try {
      this.queue = JSON.parse(window.localStorage.getItem(name) || "[]")
    } catch (e) {
      this.queue = []
    }
  }

  /*
   * no key given -> returns whole list
   */
  get (key) {
    if (!key) return this.queue

    return (this.queue.find(o => Object.keys(o)[0] === key) || {})[key] || 0
  }

  set (key, value) {
    let index = this.queue.findIndex(o => Object.keys(o)[0] === key)
    if (index !== -1) {
      this.queue[index][key] = value
      let current = this.queue.splice(index, 1)
      this.queue.unshift(current[0])
    } else {
      const len = this.queue.unshift({ [key]: value })
      if (len > 5) this.queue.pop()
    }
    window.localStorage.setItem(this.name, JSON.stringify(this.queue))
  }
}
