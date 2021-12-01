const videoSource = videoObject.querySelector("source")
const remoteControlsElm = document.querySelector(".remotecontrols")
const remoteControls = new Map()
const templateRemoteControlbox = document.getElementById("templateRemoteControlBox").innerHTML

const showErrorOverlay = (error) => {
  console.log("failed because the user didn't interact with the document first")
  const overlay = document.getElementById("overlay")
  const overlayButton = overlay.querySelector("button")
  overlayButton.innerHTML = "Click here to activate remote control"
  overlay.style.display = "inline"
  overlayButton.addEventListener("click", activateRemote)
}

const activateRemote = event => {
  overlay.style.display = "none"
  overlayButton.removeEventListener("click", activateRemote)
}

const updateRemoteControlActivity = (source, activity) => {
  // clear all activities
  remoteControlsElm.querySelectorAll("li").forEach(li => {
    li.classList.remove("current")
  })

  // add + highlight last activity
  const activityElm = remoteControlsElm.querySelector("." + source.type + "-" + source.id)
  if (activityElm) {
    activityElm.querySelector(".activity").innerText = activity
    activityElm.classList.add("current")
  }
}

document.addEventListener("evt-loadmovie", event => {
  // save old currenttime
  if (videoObject.currentTime !=0 && movie) {
    window.localStorage.setItem(movie, videoObject.currentTime)
  }

  // load movie
  videoSource.setAttribute("src", "/movies/" + event.detail.movie)
  videoSource.setAttribute("type", "video/mp4")
  videoObject.load()
  movie = event.detail.movie
  if (window.localStorage.getItem(event.detail.movie) !== null) {
    videoObject.currentTime = window.localStorage.getItem(event.detail.movie)
  }
  // inform room
  ws.send(JSON.stringify({ reason: "movieloaded", movie: event.detail.movie, roomId: monitorId }))

  // show activity
  updateRemoteControlActivity(event.detail.source, "Loaded movie")
})

document.addEventListener("evt-playstop", event => {
  const movieUrl = videoSource.getAttribute("src").replace(/^\/movies\//, "")
  if (videoObject.paused) {
    videoObject.play().then(() => {
      ws.send(JSON.stringify({ reason: "movieplaying", movie: movieUrl, roomId: monitorId }))
      updateRemoteControlActivity(event.detail.source, "Started movie")
    })
    .catch(error => {
      showErrorOverlay(error)
      ws.send(JSON.stringify({ reason: "movieplayingerror", msg: "remote not activated", movie: movieUrl, roomId: monitorId }))
      updateRemoteControlActivity(event.detail.source, "Tried to " + (videoObject.paused ? "start" : "stop") + " movie")
    })
  } else {
    videoObject.pause()
    ws.send(JSON.stringify({ reason: "moviestopped", movie: movieUrl, roomId: monitorId }))
    updateRemoteControlActivity(event.detail.source, "Stopped movie")
  }
})

document.addEventListener("evt-joined", event => {
  const { id, type } = event.detail
  if (type === "remotecontrol" && !remoteControls.get(id)) {
    remoteControls.set(id, 1)
    remoteControlsElm.insertAdjacentHTML("beforeend", templateRemoteControlbox
      .replace(/{{name}}/g, id)
      .replace(/{{type}}/g, type)
    )
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
  remoteControlsElm.querySelectorAll("li").forEach(li => {
    remoteControls.clear()
    li.remove()
  })

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
})
