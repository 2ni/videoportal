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

  // handle remote control actions
  remote.addEventListener("click", event => {
    console.log("remoteControl click", event.target.id)
    ws.send(JSON.stringify({ remoteControl: { action: event.target.id }, targetIds: [ clientList.value ] }))
  })

  // receiving info from remotcontrol
  document.addEventListener("remoteControl", event => {
    console.log("remoteControl event", event)
  })

  // load move to monitor
  moviesUl.addEventListener("click", event => {
    let elm = event.target
    let limit = 5;
    while (elm.tagName !== "A" && --limit > 0) {
      elm = elm.parentElement
    }
    const movieToLoad = elm.getAttribute("href").replace(/^\/[^/]*\//, "")
    if (selectedMovie !== null) {
      moviesUl.children[selectedMovie].querySelector("a").style.backgroundColor = ""
    }
    elm.style.backgroundColor = "rgba(128, 0, 0, .2)"
    ws.send(JSON.stringify({ remoteControl: { movie: movieToLoad, targetIds: [ monitorId ] } }))
    selectedMovie = [...moviesUl.children].indexOf(elm.parentElement)
    event.preventDefault()
  })

  fetch("/api/movies", { method: "GET", headers: {} }).then(r => {
    return r.json()
  }).then(response => {
    const dirsUl = document.querySelector("#movies-list .dirs")
    response.data.movies.forEach(movie => {
      moviesUl.insertAdjacentHTML("beforeend", templateVideoBox.replace(/{{name}}/g, movie.name).replace(/{{url}}/g, movie.url))
    })
    response.data.dirs.forEach(dir => {
      dirsUl.insertAdjacentHTML("beforeend", templateUrlBox.replace(/{{name}}/g, dir.name).replace(/{{url}}/g, dir.url))
    })
  })
}

mainRemote()
