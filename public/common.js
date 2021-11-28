let ws = null
let trial = 0

const _startWebsocket = (id) => {
  if (id) {
    ws = new WebSocket("ws://" + window.location.hostname + ":" + window.location.port + "?id=" + id)
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
      console.log("data from server", data)
      // received command from remote control, eg start, stop, load movie
      if (data.remoteControl) {
        const custEvt = new CustomEvent("remoteControl", { "detail": { ...{ "sourceId": data.sourceId}, ...data.remoteControl }})
        document.querySelector("#video-holder video").dispatchEvent(custEvt)
      }
      // push custom event "clients" as visible clients changed
      if (data.clients) {
        const custEvt = new CustomEvent("clients", { "detail": { "clients": data.clients }})
        document.dispatchEvent(custEvt)
      }
    }

    ws.onclose = event => {
      console.log("connection closed", trial)
      trial++
      ws = null
      setTimeout(_startWebsocket.bind(null, id), trial < 3 ? 300 : 5000)
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

  console.log("websockets activated")

  const clientIdElm = clientControlElm.querySelector("#client-id input")
  const clientListElm = clientControlElm.querySelector("#clients-list select")
  const clientId = (typeof remoteId !== "undefined" && remoteId)
    || (typeof monitorId !== "undefined" && monitorId)
    || window.localStorage.getItem("client-id")
    || generateBime({ length: 7 })

  console.log("clientId", clientId)
  if (!clientControlElm && !monitorId && window.localStorage.getItem("client-id") !== clientId) {
    window.localStorage.setItem("client-id", clientId)
  }

  _startWebsocket(clientId)
  clientIdElm.setAttribute("value", clientId)

  // listen for new clients
  document.addEventListener("clients", event => {
    updateClientList(event, clientListElm, clientId)
    if (event.detail.clients.list && event.detail.clients.list.includes(monitorId)) {
      clientListElm.value = monitorId
    }
  })

  clientIdElm.addEventListener("keydown", event => {
    if (event.code === "Enter" || event.key === "Enter") {
      event.target.blur()
      const id = event.target.value
      window.localStorage.setItem("client-id", id)
      ws.onclose = () => {}
      ws.close()
      _startWebsocket(id)
    }
  })
}

/*
 * update list of available clients
 */
const updateClientList = (event, selectObj, clientId) => {
  // add one client
  if (event.detail.clients.add) {
    console.log("clients add", event.detail.clients.add)
    selectObj.options.add(new Option(event.detail.clients.add))
  }
  // remove one client
  else if (event.detail.clients.remove) {
    // 1st option is "----"
    for (let i=1; i<selectObj.length; i++) {
      if (selectObj.options[i].value === event.detail.clients.remove[0]) {
        console.log("clients: remove", selectObj.options[i].value)
        selectObj.remove(i)
        break;
      }
    }
  }
  // remove all clients, ie when reloading server
  else if (event.detail.clients.removeall) {
    // 1st option is "----"
    for (let i=1; i<selectObj.length; i++) {
      selectObj.remove(i)
    }
  }
  // add whole client list
  else if (event.detail.clients.list) {
    console.log("clients: list", event.detail.clients.list)
    for (let i=1; i<selectObj.length; i++) { // never remove 1st item, as its ---
      selectObj.remove(i)
    }
    event.detail.clients.list.forEach(id => {
      if (id !== clientId) {
        selectObj.options.add(new Option(id, id))
      }
    })
  }
}

handleWebsocket(document.querySelector(".client-control"))
