const videoObject = document.querySelector("#video-holder video")
if (typeof startTime !== "undefined" && startTime) {
  videoObject.currentTime = startTime
} else if (typeof movie !== "undefined" && window.localStorage.getItem(movie) !== null) {
  const lastTime = window.localStorage.getItem(movie)
  videoObject.currentTime = lastTime
}

window.addEventListener("keydown", event => {
  if (!event.metaKey) {
    switch (event.code) {
      case "ArrowLeft":
        event.preventDefault()
        videoObject.currentTime -= 5 + (event.shiftKey ? 25 : 0)
        break
      case "ArrowRight":
        event.preventDefault()
        videoObject.currentTime +=  5 + (event.shiftKey ? 25 : 0)
        break
      case "Space":
        if (videoObject.paused) {
          videoObject.play()
        } else {
          videoObject.pause()
        }
    }
  }
})

/* needed to override default seeking ±30sec
 * as long as video is not in focus, we can use our own
 */
videoObject.addEventListener("click", event => {
  videoObject.blur()
})

window.addEventListener("unload", event => {
  // fires also on load, so wie just ignore if 0
  if (videoObject.currentTime !== 0) {
    window.localStorage.setItem(movie, videoObject.currentTime)
  }
})

const overlay = document.querySelector("#overlay")
const overlayButton = overlay.querySelector("button")
const requestFullScreen = videoObject.requestFullscreen || videoObject.mozRequestFullScreen || videoObject.webkitRequestFullScreen || videoObject.msRequestFullscreen
const cancelFullScreen = document.exitFullscreen || document.mozCancelFullScreen || document.webkitExitFullscreen || document.msExitFullscreen
let timer

const showFullscreen = event => {
  overlay.style.display = "none"
  clearTimeout(timer)
  requestFullScreen.call(videoObject)
  overlay.removeEventListener("click", showFullscreen)
}

overlay.addEventListener("transitionend", event => {
  overlay.style.display = "none"
  overlay.removeEventListener("click", showFullscreen)
  clearTimeout(timer)
})

// https://stackoverflow.com/questions/1649086/detect-rotation-of-android-phone-in-the-browser-with-javascript
// https://developers.google.com/web/fundamentals/native-hardware/fullscreen/
if (typeof monitorMode === "undefined" || monitorMode !== "true") {
  overlayButton.addEventListener("click", showFullscreen)

  window.addEventListener("resize", (event) => {
    const elm = videoObject
    const isLandscape = (window.orientation && Math.abs(window.orientation) === 90) || (window.innerWidth > window.innerHeight)
    const isNotFullscreen = !document.fullscreenElement
      && !document.mozFullScreenElement
      && !document.webkitFullscreenElement
      && !document.msFullscreenElement

    // only show overlay if not yet shown and if no input field has focus (or it'll trigger resize on mobile phones because of soft keyboard)
    if (isLandscape && isNotFullscreen && overlay.style.display !== "inline" && !["INPUT", "SELECT"].includes(document.activeElement.tagName)) {
      overlayButton.innerHTML = "Click for full screen"
      overlay.style.display = "inline"
      overlay.style.opacity = 1

      timer = setTimeout(() => {
        overlay.style.transition = "opacity " + 1 + "s";
        overlay.style.opacity = 0
      }, 3000)
    }
  })
}
