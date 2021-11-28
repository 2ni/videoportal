videoObject.addEventListener("ended", event => {
  // TODO
})

const showErrorOverlay = (error) => {
  console.log("failed because the user didn't interact with the document first")
  const overlay = document.getElementById("overlay")
  const overlayButton = overlay.querySelector("button")
  overlayButton.innerHTML = "Click here to activate remote control"
  overlay.style.display = "inline"
  overlayButton.addEventListener("click", activateRemote)
}

activateRemote = event => {
  overlay.style.display = "none"
  overlayButton.removeEventListener("click", activateRemote)
}

videoObject.addEventListener("remoteControl", event => {
  console.log("remoteControl", event.detail)
  // load movie
  if (event.detail.movie) {

    // save old times 1st
    if (videoObject.currentTime !=0 && movie) {
      window.localStorage.setItem(movie, videoObject.currentTime)
    }

    const videoSource = videoObject.querySelector("source")
    videoSource.setAttribute("src", "/movies/" + event.detail.movie)
    videoSource.setAttribute("type", "video/mp4")
    videoObject.load()
    movie = event.detail.movie
    if (window.localStorage.getItem(event.detail.movie) !== null) {
      videoObject.currentTime = window.localStorage.getItem(event.detail.movie)
    }
  }

  // remoteControl
  if (event.detail.action === "play-stop") {
    if (videoObject.paused) {
      videoObject.play().catch(error => { showErrorOverlay(error) })
    } else {
      videoObject.pause()
    }
  }
})
