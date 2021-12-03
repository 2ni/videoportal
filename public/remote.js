const monitorList = document.querySelector("#monitor-list select")
const remote = document.getElementById("remoteControl")
const remotePlayStop = remote.querySelector(".play-stop")
const remoteRewind = remote.querySelector(".rewind")
const remoteForward = remote.querySelector(".forward")
const remoteMovie = remote.querySelector(".movie")
const moviesUl = document.querySelector("#movies-list .movies")
const dirsUl = document.querySelector("#movies-list .dirs")
let selectedMovie = null
const monitors = new Map()

const templateVideoBox = document.getElementById("templateVideoBox").innerHTML
const templateUrlBox = document.getElementById("templateUrlBox").innerHTML

const remoteEnabled = (status) => {
  remotePlayStop.disabled = status ? false : true
  remoteRewind.disabled = status ? false : true
  remoteForward.disabled = status ? false : true
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

// monitor list
document.addEventListener("evt-monitorlist", event => {
  event.detail.monitors.forEach(monitor => {
    if (!monitors.get(monitor)) {
      monitors.set(monitor, 1)
      monitorList.options.add(new Option(monitor, monitor))
      if (monitorId === monitor) monitorList.value = monitor
    }
  })
})

// participant list
document.addEventListener("evt-participantlist", event => {
  /*
  event.detail.participants.forEach(participant => {
    if (participant.type === "monitor" && participant.id == monitorId) remotePlayStop.disabled = false
  })
  */
  const meta = event.detail.meta
  remoteMovie.innerText = meta.movie
  if (meta.status === "moviestopped") {
    remotePlayStop.innerText = "Play"
  }
  else if (meta.status === "movieplaying") {
    remotePlayStop.innerText = "Stop"
  }
  remoteEnabled(meta.movie)
})

// monitor connected
document.addEventListener("evt-connected", event => {
  const monitor = event.detail.id
  if (!monitors.get(monitor)) {
    monitors.set(monitor, 1)
    monitorList.options.add(new Option(monitor, monitor))
    if (monitorId === monitor) monitorList.value = monitor
  }
})

// monitor disconnected
document.addEventListener("evt-disconnected", event => {
  const monitor = event.detail.id
  if (monitors.get(monitor)) {
    monitors.delete(monitor)
    const optionDeleted = monitorList.querySelector("option[value=" + monitor + "]")
    if (optionDeleted) optionDeleted.remove()
    if (monitorList.value === monitor) monitorList.value = monitorList.options[0]
  }
})

// participant joined
document.addEventListener("evt-joined", event => {
  if (event.detail.type === "monitor") {
    const monitor = event.detail.id
    // remotePlayStop.disabled = monitorId !== monitor
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
    const newClientId = event.detail.id
    const oldClientId = event.detail.source.id
    const optionChanged = monitorList.querySelector("option[value=" + oldClientId + "]")
    if (optionChanged) {
      optionChanged.text = newClientId
      optionChanged.value = newClientId
      monitors.set(newClientId)
      monitors.delete(oldClientId)
    }
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

// monitor selection change
monitorList.addEventListener("change", event => {
  monitor = event.target.value
  console.log("remote changed", monitor)
  ws.send(JSON.stringify({
    reason: "changedroom",
    roomIdLeft: (monitorId === "---" ? "" : monitorId),
    roomIdJoined: (monitor === "---" ? "" : monitor)
  }))
  monitorId = monitor

  if (monitor === "---") {
    remoteEnabled(false)
    remoteMovie.innerText = ""
  }
})

// send "play/stop movie" command
remote.addEventListener("click", event => {
  ws.send(JSON.stringify({ reason: event.target.classList[0].replace("-", ""), roomId: monitorId }))
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
