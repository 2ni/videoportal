const videoObject = document.querySelector("#video-holder video")
const overlay = document.querySelector("#overlay")
const overlayButton = overlay.querySelector("button")
let nextMovieElm = null

const getCurrentMovie = () => {
  return videoObject.querySelector("source").getAttribute("src").replace(/^\/movies\//, "")
}

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

videoObject.addEventListener("play", event => {
  window.localStorage.setItem("lastPlayedMovie", getCurrentMovie())
})

videoObject.addEventListener("timeupdate", event => {
  const timeBeforeEnd = 60
  if (!nextMovieElm && videoObject.currentTime > (videoObject.duration - timeBeforeEnd)) {
    fetch("/api/movie/next/" + getCurrentMovie(), { method: "GET", headers: {} }).then(r => {
      return r.json()
    }).then(response => {
      if (response.nextMovie) {
        nextMovieElm = document.createElement("div")
        let movieName = response.nextMovie.replace(/^.*?([^/]*)$/, "$1").replace(/\.[^.]*$/, "")
        nextMovieElm.innerHTML = "<a href=\"/play/" + response.nextMovie + "\">" + movieName + "</a>"
        nextMovieElm.style.cssText = "position: absolute; top: 50%; background: white; right: 0; padding: .1rem; opacity: .2"
        videoObject.parentNode.insertBefore(nextMovieElm, videoObject.nextSibling)
      }
    })
  } else if (nextMovieElm && videoObject.currentTime <= (videoObject.duration - timeBeforeEnd)) {
    nextMovieElm.remove()
    nextMovieElm = null
  }
})

/*
 * video has finished
 * load next movie only if we were in fullscreen mode
 * it'll leave fullscreen when loading
 */
videoObject.addEventListener("ended", event => {
  const isFullScreen = ((window.fullScreen) || (window.innerWidth == screen.width && window.innerHeight == screen.height))
  fetch("/api/movie/next/" + getCurrentMovie(), { method: "GET", headers: {} }).then(r => {
    return r.json()
  }).then(response => {
    if (response.nextMovie) {
      document.dispatchEvent(new CustomEvent("evt-movieended", { detail: { nextMovie: response.nextMovie, isFullScreen: isFullScreen }}))
    }
  })
})

// normal play mode
if (typeof monitorId === "undefined") {
  document.addEventListener("evt-movieended", event => {
    if (event.detail.isFullScreen) {
      console.log("loading next movie", event.detail.nextMovie)
      window.location = "/play" + event.detail.nextMovie
    }
  })
}

// forward, rewind or set new time
videoObject.addEventListener("seeked", event => {
// TODO
})

// save progress
// TODO switch to cookie with max-age
window.addEventListener("unload", event => {
  // fires also on load, so wie just ignore if 0
  if (videoObject.currentTime !== 0) {
    window.localStorage.setItem(movie, videoObject.currentTime)
  }
})

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
    overlayButton.addEventListener("click", showFullscreen)

    timer = setTimeout(() => {
      overlay.style.transition = "opacity " + 1 + "s";
      overlay.style.opacity = 0
    }, 3000)
  }
})
