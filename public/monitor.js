videoObject.addEventListener("remoteControl", event => {
  console.log("remoteControl", event.detail)
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
  if (event.detail.action === "play") {
    console.log("play")
    videoObject.play()
  }
})
