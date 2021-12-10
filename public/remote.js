const roomList = document.querySelector("#room-list select")
const remote = document.getElementById("remoteControl")
const remotePlayStop = remote.querySelector(".play-stop")
const remotePlayStopText = remotePlayStop.querySelector("span")
const remoteRewind = remote.querySelector(".rewind")
const remoteForward = remote.querySelector(".forward")
const remotePrevious = remote.querySelector(".previous")
const remoteNext = remote.querySelector(".next")
const remoteMovie = remote.querySelector(".movie")
const moviesUl = document.querySelector("#movies-list .movies")
const dirsUl = document.querySelector("#movies-list .dirs")
const rooms = new Map()
let hasMonitor = false

const templateVideoBox = document.getElementById("templateVideoBox").innerHTML
const templateUrlBox = document.getElementById("templateUrlBox").innerHTML

// start websocket communication
handleWebsocket(document.querySelector(".client-control"))

const remoteEnabled = (newmovie) => {
  if (newmovie) {
    remotePlayStop.disabled = false
    remoteRewind.disabled = false
    remoteForward.disabled = false
    fetch("/api/movie/next/" + newmovie, { method: "GET", headers: {} }).then(r => {
      return r.json()
    }).then(response => {
      if (response.nextMovie) {
        remoteNext.dataset.movie = response.nextMovie
        remoteNext.disabled = false
      } else {
        remoteNext.removeAttribute("data-movie")
        remoteNext.disabled = true
      }
      if (response.previousMovie) {
        remotePrevious.dataset.movie = response.previousMovie
        remotePrevious.disabled = false
      } else {
        remotePrevious.removeAttribute("data-movie")
        remotePrevious.disabled = true
      }
    })
  } else {
    remotePlayStop.disabled = true
    remoteRewind.disabled = true
    remoteForward.disabled = true
    remoteNext.disabled = true
    remotePrevious.disabled = true
    remoteNext.removeAttribute("data-movie")
    remotePrevious.removeAttribute("data-movie")
  }

}

const updateRemoteStatus = (meta) => {
  remoteMovie.innerText = meta.movie.replace(/^.*?([^/]*)\.[^.]*$/, "$1")
  if (meta.status === "moviestopped") {
    remotePlayStopText.innerText = "play_circle_filled"
  }
  else if (meta.status === "movieplaying") {
    remotePlayStopText.innerText = "pause"
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
  hasMonitor = event.detail.meta.hasmonitor
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
  hasMonitor = event.detail.meta.hasmonitor
  const optionElm = roomList.querySelector("option[value=" + event.detail.id + "]")
  if (optionElm) {
    optionElm.text = (event.detail.meta.hasmonitor ? "" : "\u23FE ") + event.detail.id
  }
})

// participant list
document.addEventListener("evt-participantlist", event => {
  const meta = event.detail.meta
  hasMonitor = meta.hasmonitor
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
  remoteEnabled(event.detail.movie)
  remoteMovie.innerHTML = event.detail.movie.replace(/^.*?([^/]*)\.[^.]*$/, "$1")
    + "<span class=\"currenttime\">" + timestamp2human(event.detail.currenttime) + "</span>"
})

// monitor can not  be controlled
document.addEventListener("evt-movieplayingerror", event => {
  remoteEnabled(null)
  remote.querySelector(".status").innerText = event.detail.msg
})

document.addEventListener("evt-remoteactivated", event => {
  remoteEnabled(event.detail.meta.movie)
  remote.querySelector(".status").innerText = ""
})

// participant left
document.addEventListener("evt-left", event => {
  if (event.detail.type === "monitor") {
    const monitor = event.detail.id
    remoteMovie.innerText = ""
    remotePlayStopText.innerText = "play_circle_filled"
    remoteEnabled(null)
  }
})

// participant changed id (for now only handle monitor)
document.addEventListener("evt-changedclientid", event => {
  if (event.detail.type === "monitor") {
    if (event.detail.meta) {
      updateRemoteStatus(event.detail.meta)
      remoteEnabled(event.detail.meta.movie)
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
  remotePlayStopText.innerText = "pause"
})

// monitor has stopped movie
document.addEventListener("evt-moviestopped", event => {
  remotePlayStopText.innerText = "play_circle_filled"
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
    remoteEnabled(null)
    remoteMovie.innerText = ""
  }
})

// send "play/stop movie" command
remote.addEventListener("click", event => {
  let elm = event.target
  let limit = 3
  while (elm.tagName !== "BUTTON" && --limit > 0) elm = elm.parentElement
  if (elm.tagName === "BUTTON") {
    const classList = [...elm.classList]
    if (classList.includes("next") || classList.includes("previous")) {
      if (elm.dataset.movie) {
        ws.send(JSON.stringify({ reason: "loadmovie", movie: elm.dataset.movie, roomId: monitorId }))
      }
    } else {
      ws.send(JSON.stringify({ reason: elm.classList[0].replace("-", ""), roomId: monitorId }))
    }
  }
})

// send "load movie" command
moviesUl.addEventListener("click", event => {
  if (!hasMonitor) {
    event.preventDefault()
    return
  }

  let elm = event.target
  let limit = 5;
  while (elm.tagName !== "A" && --limit > 0) {
    elm = elm.parentElement
  }
  const movieToLoad = elm && elm.getAttribute("href") && elm.getAttribute("href").replace(/^\/[^/]*\//, "")
  if (movieToLoad) {
    ws.send(JSON.stringify({ reason: "loadmovie", movie: movieToLoad, roomId: monitorId }))
    elm.classList.add("flash")
    setTimeout(() => {
      elm.classList.remove("flash")
    }, 500)
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
