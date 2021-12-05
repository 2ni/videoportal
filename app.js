#!/usr/bin/env node

import express from "express"
import bodyParser from "body-parser"
import helmet from "helmet"
import os from "os"
import path from "path"
import cors from "cors"
import { engine } from "express-handlebars"
import fs, { promises as fsp} from "fs"
import crypto from "crypto"
import WebSocket, { WebSocketServer } from "ws"
import url from "url"
import filetype from "file-type"

import { env, config } from "./config/app.js"
import * as handlebarsHelpers from "./helpers/handlebars.js"
import { timestamp, capitalize, getBreadcrumbs } from "./helpers/utils.js"
import wss from "./wss.js"

const __dirname = path.resolve(path.dirname(""))

const app = express()
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use("/", express.static("public"))
app.use(getBreadcrumbs)
app.engine(".hbs", engine({ extname: ".hbs", helpers: handlebarsHelpers, partialsDir: "views/partials" }))
app.set("view engine", ".hbs")
app.set("views", "./views")
// https://stackoverflow.com/questions/64534727/nodejs-err-ssl-protocol-error-in-http-server#answer-67580077
// app.use(helmet({ contentSecurityPolicy: env === "localhost" ? false : true }))
app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors({
  origin: [
    "http://localhost:3001",
    "http://hironderlle:3001"
  ]
}))

const server = app.listen(config.port, (err) => {
  if (err) {
    return console.log("something bad happened", err)
  }
  console.log(`\n\n${timestamp()} server is listening on http://${os.hostname()}:${config.port}`)
})

process.on("exit", () => {
  wss.emit("exit")
})

process.on("SIGINT", () => {
  process.exit()
})

// avoid multiple calls, eg on nodemon restart
process.once("SIGUSR2", () => {
  wss.emit("exit")
})

server.on("upgrade", async (request, socket, head) => {
  // TODO https://github.com/websockets/ws/issues/377#issuecomment-462152231
  let args = []
  try {
    // args = await verifyClient()
  } catch (e) {
    socket.destroy()
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request, ...args)
  })
})


/*****************************************************
 * routes
 *****************************************************/

app.get("/movies/:movie([^$]+)", (req, res) => {
  const moviePath = path.join(config.moviesBasePath, req.params.movie)
  const stat = fs.statSync(moviePath)
  const fileSize = stat.size
  const range = req.headers.range
  if (range) {
    const parts = range.replace(/bytes=/, "").split("-")
    const start = parseInt(parts[0], 10)
    const end = parts[1]
      ? parseInt(parts[1], 10)
      : fileSize-1
    const chunksize = (end-start)+1
    const file = fs.createReadStream(moviePath, {start, end})
    const head = {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunksize,
      "Content-Type": "video/mp4",
    }
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      "Content-Length": fileSize,
      "Content-Type": "video/mp4",
    }
    res.writeHead(200, head)
    fs.createReadStream(moviePath).pipe(res)
  }
})

app.get("/play/:movie([^$]+)", (req, res) => {
  const nonce = crypto.randomBytes(16).toString("base64")
  res.set("Content-Security-Policy", "script-src 'self' 'nonce-" + nonce + "'")
  res.render("play", {
    nonce: nonce,
    jsInit: {
      movie: req.params.movie,
      startTime: req.query.t,
    },
    scripts: ["play.js"]
  })
})

app.get("/monitor/:monitorId?", (req, res) => {
  const nonce = crypto.randomBytes(16).toString("base64")
  res.render("monitor", {
    nonce: nonce,
    useWebsockets: true,
    jsInit: {
      monitorId: req.params.monitorId,
    },
    scripts: ["play.js", "monitor.js"],
  })
})

app.get("/remote/:remoteId?/:monitorId?", async (req, res) => {
  const nonce = crypto.randomBytes(16).toString("base64")

  res.render("remote", {
    nonce: nonce,
    useWebsockets: true,
    isRemote: true,
    jsInit: {
      monitorId: req.params.monitorId,
      remoteId: req.params.remoteId,
    },
    scripts: ["remote.js"],
  })
})

/*
 * https://stackoverflow.com/questions/59352613/i-want-to-find-a-file-of-a-specific-extension-using-readdir-async-with-recursi
 *
 * only show movies and dirs
 */
const walk = async (moviesDir, curPath, results={ movies: [], dirs: [] }) => {
  const files = await fsp.readdir(moviesDir, { withFileTypes: true })
  for (const file of files) {
    const fullPath = path.join(moviesDir, file.name)
    const movieUrl = path.join(curPath, file.name)
    const movieName = capitalize(movieUrl.split("/").slice(-1)[0])
    if (file.isFile()) {
      const f = await filetype.fromFile(fullPath)
      if (f &&  f.mime === "video/mp4") {
        results.movies.push({ name: movieName, url: movieUrl })
      }
    } else if (file.isDirectory()) {
      results.dirs.push({ name: movieName, url: movieUrl })
    }
  }
  return results
}

/*
 * eg http -b :3001/api/movies/sacha
 */
app.get([ "/api/movies/:path(*)", "/api/movies" ], async (req, res) => {
  const curPath = req.params.path || ""
  const moviesDir = path.join(config.moviesBasePath, curPath)
  try {
    const dirData = await walk(moviesDir, curPath)
    return res.status(200).send({ moviesDir: moviesDir, data: dirData })
  } catch (e) {
    return res.stats(404).send({ moviesDir: "", data: {} })
  }
})

app.get("*", async (req, res) => {
  const curPath = req.url.replace(/^\//, "")
  const moviesDir = path.join(config.moviesBasePath, curPath)
  try {
    const dirData = await walk(moviesDir, curPath)
    res.render("home", {
      movies: dirData.movies,
      dirs: dirData.dirs,
      scripts: ["home.js"]
    })
  } catch (e) {
    return res.render("404")
  }
})

