/*
 * websocket setup
 */
let ws = null

const startWebsocket = (id) => {
  if (id) {
    ws = new WebSocket("ws://" + window.location.hostname + ":" + window.location.port + "?id=" + id)
    ws.onopen = () => {
      console.log("connection opened", id)
    }

    ws.onmessage = ({ data }) => {
      try {
        data = JSON.parse(data)
      } catch (e) {
        data = {}
      }
      console.log("data from server", data)
      if (data.remoteControl) {
        const custEvt = new CustomEvent("remoteControl", { "detail": { ...{ "sourceId": data.sourceId}, ...data.remoteControl }})
        document.querySelector("#video-holder video").dispatchEvent(custEvt)
      }
      // push custom event "clients" as visible clients changed
      if (data.clients) {
        const custEvt = new CustomEvent("clients", { "detail": { "clients": data.clients }})
        document.getElementById("clients-list").dispatchEvent(custEvt)
      }
    }

    ws.onclose = event => {
      console.log("connection closed")
      ws = null
      setTimeout(startWebsocket.bind(null, id), 1000)
    }
  }
}

/*
 * handle client id
 */
const idElm = document.querySelector("#client-id input")

const makeid = (length) => {
    var result           = "";
    var characters       = "BCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   return result;
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

const main = () => {
  let id
  if (monitorId) {
    id = monitorId
  } else if (window.localStorage.getItem("client-id") !== null) {
    id = window.localStorage.getItem("client-id")
  } else {
    id = generateBime({ length: 7 })
    window.localStorage.setItem("client-id", id)
  }
  startWebsocket(id)
  idElm.setAttribute("value", id)
}

idElm.addEventListener("keydown", event => {
  if (event.code === "Enter" || event.key === "Enter") {
    event.target.blur()
    const id = event.target.value
    window.localStorage.setItem("client-id", id)
    ws.onclose = () => {}
    ws.close()
    startWebsocket(id)
  }
})

/*
 * handle custom event "clients"
 */
const clientsList = document.getElementById("clients-list")
clientsList.addEventListener("clients", event => {
  const selectObj = clientsList.querySelector("select")
  if (event.detail.clients.list) {
    console.log("new client list", event.detail.clients.list)
    for (let i=1; i<selectObj.length; i++) { // never remove 1st item, as its ---
      selectObj.remove(i)
    }
    event.detail.clients.list.forEach(id => {
      selectObj.options.add(new Option(id, id))
    })
  }
  if (event.detail.clients.remove) {
    // console.log("remove client", event.detail.clients.remove)
    for (let i=0; i<selectObj.length; i++) {
      if (selectObj.options[i].value === event.detail.clients.remove[0]) {
        console.log("removing client", selectObj.options[i].value)
        selectObj.remove(i)
        break;
      }
    }
  }
})

main()
