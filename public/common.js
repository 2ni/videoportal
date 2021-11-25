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
      data = JSON.parse(data)
      // custom event "clients"
      if (data.clients) {
        const eventNewClients = new CustomEvent("clients", { "detail": { "clients": data.clients }})
        document.getElementById("clients-list").dispatchEvent(eventNewClients)
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

const main = () => {
  let id
  if (window.localStorage.getItem("client-id") !== null) {
    id = window.localStorage.getItem("client-id")
  } else {
    id = makeid(10)
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
