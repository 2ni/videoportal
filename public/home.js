/*
 * show video, duration and time seen
 */
const videoObjects = document.querySelectorAll("#movies-list ul.movies li a video")
videoObjects.forEach(videoObject => {
  videoObject.addEventListener("loadedmetadata", event => {
    const progressBarElm = videoObject.nextElementSibling
    // set progressbar width (max-width: 200px, max-height: 75px)
    const factor = Math.max(videoObject.videoWidth/200, videoObject.videoHeight/75)
    progressBarElm.style.width = Math.round(videoObject.videoWidth/factor) + "px"

    // show duration of movie
    const durElm = videoObject.nextElementSibling.nextElementSibling.querySelector(".duration")
    let duration = new Date(1000*videoObject.duration).toISOString().substr(11, 8).replace(/00:/g, "")
    const num = (duration.match(/:/g) || []).length
    duration += num == 2 ? "hours" : (num == 1 ? "min": "sec")
    durElm.textContent = duration

    // get duration of movie already seen and update progressbar
    const movieName = videoObject.querySelector("source").src.replace(/^.*\/movies\//, "")
    if (window.localStorage.getItem(movieName) !== null) {
      const durationSeen = window.localStorage.getItem(movieName)
      const progressElm = progressBarElm.querySelector(".progress")
      const progress = Math.round(100*durationSeen/videoObject.duration) + "%"
      progressElm.style.width = progress
      progressBarElm.title = progress
    }
  })
})
