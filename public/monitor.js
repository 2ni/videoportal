const videoSource = videoObject.querySelector("source")
const remoteControlsElm = document.querySelector("#remoteControls")
const remoteControls = new Map()
const templateRemoteControlbox = document.getElementById("templateRemoteControlBox").innerHTML

// start websocket communication
handleWebsocket(document.querySelector(".client-control"))

const showErrorOverlay = (error) => {
  const overlay = document.getElementById("overlay")
  const overlayButton = overlay.querySelector("button")
  overlayButton.innerHTML = "Click here to activate remote control"
  overlay.style.display = "inline"
  overlayButton.addEventListener("click", activateRemote)
}

const activateRemote = event => {
  overlay.style.display = "none"
  ws.send(JSON.stringify({ reason: "remoteactivated", roomId: monitorId, movie: getCurrentMovie(), currenttime: videoObject.currentTime }))
  overlayButton.removeEventListener("click", activateRemote)
}

const updateRemoteControlActivity = (source, activity) => {
  let activityElm = null
  // clear last active mark
  remoteControlsElm.querySelectorAll("li").forEach(li => {
    li.classList.remove("lastactive")
    activityElm = li.querySelector(".activity")
    const opacity = activityElm.style.opacity
    if (activityElm.innerText && (opacity === "" || opacity >= 0)) {
      activityElm.style.opacity = (opacity || 1) - .2
    }
  })

  // add + highlight last activity
  const activeLiElm = remoteControlsElm.querySelector("." + source.type + "-" + source.id)
  if (activeLiElm) {
    activityElm = activeLiElm.querySelector(".activity")
    activityElm.innerText = activity
    activityElm.style.opacity = ""

    activeLiElm.classList.add("lastactive")
    activeLiElm.classList.add("flash")
    setTimeout(() => {
      activeLiElm.classList.remove("flash")
    }, 500)
  }
}

const loadMovie = (m) => {
  // load movie
  videoSource.setAttribute("src", "/movies/" + m)
  videoSource.setAttribute("type", "video/mp4")
  videoObject.load()
  movie = m
}


// video starts playing
videoObject.addEventListener("play", event => {
  ws.send(JSON.stringify({ reason: "movieplaying", movie: getCurrentMovie(), roomId: monitorId }))
})

// video stopped
videoObject.addEventListener("pause", event => {
  ws.send(JSON.stringify({ reason: "moviestopped", movie: getCurrentMovie(), roomId: monitorId }))
})

// video loaded
videoObject.addEventListener("loadedmetadata", event => {
  const m = getCurrentMovie()
  const cur = new Fifo("currentTimes").get(m)
  if (cur) {
    videoObject.currentTime = (videoObject.duration - cur) < 0.2 ? (cur - 0.1) : cur
  }

  // inform room
  ws.send(JSON.stringify({ reason: "movieloaded", movie: m, roomId: monitorId, currenttime: videoObject.currentTime }))
})

document.addEventListener("evt-loadmovie", event => {
  // save old currenttime
  if (videoObject.currentTime !=0 && movie) {
    window.localStorage.setItem(movie, videoObject.currentTime)
  }

  // load movie
  loadMovie(event.detail.movie)

  // show activity
  updateRemoteControlActivity(event.detail.source, "Loaded movie " + prettifyMovie(getCurrentMovie()))
})

document.addEventListener("evt-movieended", event => {
  window.localStorage.setItem(movie, videoObject.currentTime)
  loadMovie(event.detail.nextMovie)
  ws.send(JSON.stringify({ reason: "loadmovie", movie: event.detail.nextMovie, roomId: monitorId, currenttime: videoObject.currentTime }))
})

/*
 * play or stop cmd received
 * notification about playing/stopped is sent on video eventlistener "play", "pause"
 */
document.addEventListener("evt-playstop", event => {
  const movieUrl = videoSource.getAttribute("src").replace(/^\/movies\//, "")
  if (videoObject.paused) {
    videoObject.play().then(() => {
      updateRemoteControlActivity(event.detail.source, "Started movie")
    })
    .catch(error => {
      showErrorOverlay(error)
      ws.send(JSON.stringify({ reason: "movieplayingerror", msg: "remote not activated", movie: movieUrl, roomId: monitorId }))
      updateRemoteControlActivity(event.detail.source, "Tried to " + (videoObject.paused ? "start" : "stop") + " movie")
    })
  } else {
    videoObject.pause()
    window.localStorage.setItem(movie, videoObject.currentTime)
    updateRemoteControlActivity(event.detail.source, "Stopped movie")
  }
})

document.addEventListener("evt-rewind", event => {
  videoObject.currentTime -= 5
  updateRemoteControlActivity(event.detail.source, "Rewind")
})

document.addEventListener("evt-forward", event => {
  videoObject.currentTime += 5
  updateRemoteControlActivity(event.detail.source, "Forward")
})

document.addEventListener("evt-joined", event => {
  const { id, type } = event.detail
  if (type === "remotecontrol" && !remoteControls.get(id)) {
    remoteControls.set(id, 1)
    remoteControlsElm.insertAdjacentHTML("beforeend", templateRemoteControlbox
      .replace(/{{name}}/g, id)
      .replace(/{{type}}/g, type)
    )
    updateRemoteControlActivity(event.detail, "Joined")
  }
})

document.addEventListener("evt-left", event => {
  const { id, type } = event.detail
  if (type === "remotecontrol" && remoteControls.get(id)) {
    remoteControls.delete(id)
    const li = remoteControlsElm.querySelector("." + type + "-" + id)
    if (li) li.remove()
  }
})

document.addEventListener("evt-participantlist", event => {
  // clear all first
  remoteControls.clear()
  remoteControlsElm.innerHTML = ""

  let id = null
  let type = null
  event.detail.participants.forEach(participant => {
    ({ id, type } = participant)
    if (type === "remotecontrol") {
      remoteControls.set(id, 1)
      remoteControlsElm.insertAdjacentHTML("beforeend", templateRemoteControlbox
        .replace(/{{name}}/g, id)
        .replace(/{{type}}/g, type)
      )
    }
  })

  // send movieloaded if meta has no information but monitor has movie loaded
  // (happens if wss restarts)
  if (!event.detail.meta.movie && videoSource.getAttribute("src")) {
    ws.send(JSON.stringify({
      reason: "movieloaded",
      movie: videoSource.getAttribute("src").replace(/^\/movies\//, ""),
      roomId: monitorId,
      currenttime: videoObject.currentTime
    }))
  }
  // load movie given from participantlist, eg if monitor joins / reloads and movie has already been set in room
  else if (event.detail.meta.movie) {
    loadMovie(event.detail.meta.movie)
  }
})

document.addEventListener("evt-changedclientid", event => {
  if (event.detail.type === "remotecontrol") {
    const li = remoteControlsElm.querySelector("li." + event.detail.type + "-" + event.detail.sourceid)
    if (li) {
      remoteControls.set(event.detail.id, 1)
      remoteControls.delete(event.detail.sourceid)
      li.querySelector(".name").innerText = event.detail.id
      li.classList.remove(event.detail.type + "-" + event.detail.sourceid)
      li.classList.add(event.detail.type + "-" + event.detail.id)
      updateRemoteControlActivity(event.detail, "Changed name")
    }
  }
})
