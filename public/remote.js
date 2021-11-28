const clientList = document.querySelector("#clients-list select")
const remote = document.getElementById("remoteControl")
const remotePlayStop = remote.querySelector("#play-stop")
const moviesUl = document.querySelector("#movies-list .movies")
let selectedMovie = null

const mainRemote = () => {
  const templateVideoBox = document.getElementById("templateVideoBox").innerHTML
  const templateUrlBox = document.getElementById("templateUrlBox").innerHTML

  document.addEventListener("clients", event => {
    remotePlayStop.disabled = !event.detail.clients.list || !event.detail.clients.list.includes(monitorId)
  })

  // handle monitor selection change
  clientList.addEventListener("change", event => {
    monitorId = event.target.value
  })

  // handle remote control actions
  remote.addEventListener("click", event => {
    console.log("remoteControl click", event.target.id)
    ws.send(JSON.stringify({ remoteControl: { action: event.target.id }, targetIds: [ clientList.value ] }))
  })

  // receiving info from remotcontrol
  // TODO
  document.addEventListener("remoteControl", event => {
    console.log("remoteControl event", event)
  })

  // load movie to monitor
  moviesUl.addEventListener("click", event => {
    let elm = event.target
    let limit = 5;
    while (elm.tagName !== "A" && --limit > 0) {
      elm = elm.parentElement
    }
    const movieToLoad = elm && elm.getAttribute("href").replace(/^\/[^/]*\//, "")
    if (movieToLoad) {
      if (selectedMovie !== null) {
        moviesUl.children[selectedMovie].querySelector("a").style.backgroundColor = ""
      }
      elm.style.backgroundColor = "rgba(128, 0, 0, .2)"
      ws.send(JSON.stringify({ remoteControl: { movie: movieToLoad }, targetIds: [ monitorId ] }))
      selectedMovie = [...moviesUl.children].indexOf(elm.parentElement)
    }
    event.preventDefault()
  })

  fetch("/api/movies", { method: "GET", headers: {} }).then(r => {
    return r.json()
  }).then(response => {
    const dirsUl = document.querySelector("#movies-list .dirs")
    response.data.movies.forEach(movie => {
      moviesUl.insertAdjacentHTML("beforeend", templateVideoBox
        .replace(/{{name}}/g, movie.name.replace(/\..*$/, ""))
        .replace(/{{url}}/g, movie.url))

      // show duration of video
      const mov = moviesUl.querySelector("li:last-child video")
      const loadDuration = (event) => {
        let duration = new Date(1000*event.target.duration).toISOString().substr(11, 8).replace(/00:/g, "")
        const num = (duration.match(/:/g) || []).length
        duration += num == 2 ? "hours" : (num == 1 ? "min": "sec")
        event.target.parentElement.querySelector(".duration").textContent = duration

        mov.removeEventListener("loadedmetadata", loadDuration)
      }
      mov.addEventListener("loadedmetadata", loadDuration)
    })
    response.data.dirs.forEach(dir => {
      dirsUl.insertAdjacentHTML("beforeend", templateUrlBox.replace(/{{name}}/g, dir.name).replace(/{{url}}/g, dir.url))
    })
  })
}

mainRemote()
