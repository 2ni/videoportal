const roomList = document.querySelector("#room-list select")
const remote = document.getElementById("remoteControl")
const remotePlayStop = remote.querySelector(".play-stop")
const remoteRewind = remote.querySelector(".rewind")
const remoteForward = remote.querySelector(".forward")
const remoteMovie = remote.querySelector(".movie")
const moviesUl = document.querySelector("#movies-list .movies")
const dirsUl = document.querySelector("#movies-list .dirs")
let selectedMovie = null
const rooms = new Map()

const templateVideoBox = document.getElementById("templateVideoBox").innerHTML
const templateUrlBox = document.getElementById("templateUrlBox").innerHTML

// start websocket communication
handleWebsocket(document.querySelector(".client-control"))

const remoteEnabled = (status) => {
  remotePlayStop.disabled = status ? false : true
  remoteRewind.disabled = status ? false : true
  remoteForward.disabled = status ? false : true
}

const updateRemoteStatus = (meta) => {
  remoteMovie.innerText = meta.movie
  if (meta.status === "moviestopped") {
    remotePlayStop.innerText = "Play"
  }
  else if (meta.status === "movieplaying") {
    remotePlayStop.innerText = "Stop"
  }
}

const timestamp2human = (timestamp) => {
  let duration = new Date(1000*timestamp).toISOString().substr(11, 8).replace(/00:/g, "")
  const num = (duration.match(/:/g) || []).length
  duration += num == 2 ? "hours" : (num == 1 ? "min": "sec")
  return duration
}

const getMovies = (dir = "") => {
  fetch("/api/movies/" + dir, { method: "GET", headers: {} }).then(r => {
    return r.json()
  }).then(response => {
    moviesUl.innerHTML = ""
    response.data.movies.forEach(movie => {
      moviesUl.insertAdjacentHTML("beforeend", templateVideoBox
        .replace(/{{name}}/g, movie.name.replace(/\..*$/, ""))
        .replace(/{{url}}/g, movie.url))

      // show duration of video
      const mov = moviesUl.querySelector("li:last-child video")
      const loadDuration = (event) => {
        event.target.parentElement.querySelector(".duration").textContent = timestamp2human(event.target.duration)

        mov.removeEventListener("loadedmetadata", loadDuration)
      }
      mov.addEventListener("loadedmetadata", loadDuration)
    })

    // dirs
    dirsUl.innerHTML = ""
    response.data.dirs.forEach(dir => {
      dirsUl.insertAdjacentHTML("beforeend", templateUrlBox.replace(/{{name}}/g, dir.name).replace(/{{url}}/g, dir.url))
    })
  })
}

// initial room list on page load
document.addEventListener("evt-roomlist", event => {
  const triggerChange = rooms.get(monitorId) // send join event in case wss restarts
  event.detail.rooms.forEach(room => {
    if (!rooms.get(room.id)) {
      rooms.set(room.id, 1)
      roomList.options.add(new Option((room.meta.hasmonitor ? "" : "\u23FE ") + room.id, room.id))
      if (monitorId === room.id) roomList.value = room.id
    }
  })

  if (triggerChange) {
    monitorId = "---" // avoid sending left + joined => only joined
    roomList.dispatchEvent(new Event("change"))
  }
})

// room was created
document.addEventListener("evt-roomadded", event => {
  const roomId = event.detail.id
  if (!rooms.get(roomId)) {
    rooms.set(roomId, 1)
    roomList.options.add(new Option((event.detail.meta.hasmonitor ? "" : "\u23FE ") + roomId, roomId))
    if (monitorId === roomId) roomList.value = roomId
  }
})

// room was deleted
document.addEventListener("evt-roomdeleted", event => {
  const roomId = event.detail.id
  if (rooms.get(roomId)) {
    rooms.delete(roomId)
    const optionDeleted = roomList.querySelector("option[value=" + roomId + "]")
    if (optionDeleted) optionDeleted.remove()
    if (roomList.value === roomId) roomList.value = roomList.options[0]
  }
})

// room was changed
document.addEventListener("evt-roomchanged", event => {
  const optionElm = roomList.querySelector("option[value=" + event.detail.id + "]")
  if (optionElm) {
    optionElm.text = (event.detail.meta.hasmonitor ? "" : "\u23FE ") + event.detail.id
  }
})

// participant list
document.addEventListener("evt-participantlist", event => {
  const meta = event.detail.meta
  updateRemoteStatus(meta)
  remoteEnabled(meta.movie)
})

// participant joined
document.addEventListener("evt-joined", event => {
  if (event.detail.type === "monitor") {
    const monitor = event.detail.id
  }
})

// monitor loaded movie
document.addEventListener("evt-movieloaded", event => {
  remoteEnabled(true)
  remoteMovie.innerHTML = event.detail.movie + "<span class=\"currenttime\">" + timestamp2human(event.detail.currenttime) + "</span>"
})

// monitor can not  be controlled
document.addEventListener("evt-movieplayingerror", event => {
  remoteEnabled(false)
  remote.querySelector(".status").innerText = event.detail.msg
})

document.addEventListener("evt-remoteactivated", event => {
  remoteEnabled(true)
  remote.querySelector(".status").innerText = ""
})

// participant left
document.addEventListener("evt-left", event => {
  if (event.detail.type === "monitor") {
    const monitor = event.detail.id
    remoteMovie.innerText = ""
    remotePlayStop.innerText = "Play"
    remoteEnabled(false)
  }
})

// participant changed id (for now only handle monitor)
document.addEventListener("evt-changedclientid", event => {
  if (event.detail.type === "monitor") {
    if (event.detail.meta) {
      updateRemoteStatus(event.detail.meta)
      remoteEnabled(true)
    }

    const newClientId = event.detail.id
    const oldClientId = event.detail.sourceid
    const optionToRemove = roomList.querySelector("option[value=" + newClientId + "]")
    const optionToChange = roomList.querySelector("option[value=" + oldClientId + "]")
    if (optionToRemove) {
      optionToRemove.remove()
    }
    // we need to wait, or the remove will mess up things as it seems :-(
    setTimeout(() => {
      if (optionToChange) {
        optionToChange.text = newClientId
        optionToChange.value = newClientId
        if (monitorId === newClientId) roomList.value = newClientId
        rooms.set(newClientId)
        rooms.delete(oldClientId)
        monitorId = newClientId
      }
    }, 100)
  }
})

// monitor is playing movie
document.addEventListener("evt-movieplaying", event => {
  remotePlayStop.innerText = "Stop"
})

// monitor has stopped movie
document.addEventListener("evt-moviestopped", event => {
  remotePlayStop.innerText = "Play"
})

// room selection change
roomList.addEventListener("change", event => {
  roomId = event.target.value
  console.log("remote changed room to ", roomId)
  ws.send(JSON.stringify({
    reason: "changedroom",
    roomIdLeft: (monitorId === "---" ? "" : monitorId),
    roomIdJoined: (roomId === "---" ? "" : roomId)
  }))
  monitorId = roomId

  if (roomId === "---") {
    remoteEnabled(false)
    remoteMovie.innerText = ""
  }
})

// send "play/stop movie" command
remote.addEventListener("click", event => {
  if (event.target.tagName === "BUTTON") {
    ws.send(JSON.stringify({ reason: event.target.classList[0].replace("-", ""), roomId: monitorId }))
  }
})

// send "load movie" command
moviesUl.addEventListener("click", event => {
  let elm = event.target
  let limit = 5;
  while (elm.tagName !== "A" && --limit > 0) {
    elm = elm.parentElement
  }
  const movieToLoad = elm && elm.getAttribute("href") && elm.getAttribute("href").replace(/^\/[^/]*\//, "")
  if (movieToLoad) {
    if (selectedMovie !== null) {
      moviesUl.children[selectedMovie].querySelector("a").style.backgroundColor = ""
    }
    elm.style.backgroundColor = "rgba(128, 0, 0, .2)"
    ws.send(JSON.stringify({ reason: "loadmovie", movie: movieToLoad, roomId: monitorId }))
    selectedMovie = [...moviesUl.children].indexOf(elm.parentElement)
  }
  event.preventDefault()
})

// load dir
dirsUl.addEventListener("click", event => {
  const elm = event.target
  if (elm.tagName !== "A") return

  window.location.hash = "#" + elm.getAttribute("href")
  event.preventDefault()
})

window.addEventListener("hashchange", event => {
  getMovies(window.location.hash.replace(/#/, ""))
})

getMovies(window.location.hash.replace(/#/, ""))
