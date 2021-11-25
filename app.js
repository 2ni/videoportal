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
import { v4 as uuid } from "uuid"
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
app.engine(".hbs", engine({ extname: ".hbs", helpers: handlebarsHelpers }))
app.set("view engine", ".hbs")
app.set("views", "./views")
// https://stackoverflow.com/questions/64534727/nodejs-err-ssl-protocol-error-in-http-server#answer-67580077
app.use(helmet({ contentSecurityPolicy: env === "localhost" ? false : true }))
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

  console.log(timestamp(), `\n\nserver is listening on http://${os.hostname()}:${config.port}`)
})

server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request)
  })
})

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
    jsValues: {
      movie: req.params.movie,
      startTime: req.query.t
    },
    scripts: ["play.js"]
  })
})

// https://stackoverflow.com/questions/59352613/i-want-to-find-a-file-of-a-specific-extension-using-readdir-async-with-recursi
const walk = async (moviesDir, curPath, results={ movies: [], dirs: [] }) => {
  const files = await fsp.readdir(moviesDir, { withFileTypes: true })
  for (const file of files) {
    const fullPath = path.join(moviesDir, file.name)
    const movieUrl = path.join(curPath, file.name)
    const movieName = capitalize(movieUrl.split("/").at(-1))
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

app.get("*", async (req, res) => {
  const curPath = req.url.replace(/^\//, "")
  const moviesDir = path.join(config.moviesBasePath, curPath)
  const dirData = await walk(moviesDir, curPath)

  res.render("home", {
    movies: dirData.movies,
    dirs: dirData.dirs,
    scripts: ["home.js"]
  })
})
