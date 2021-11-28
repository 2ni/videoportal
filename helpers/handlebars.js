import fs from "fs"
import path from "path"

const fn2name = (fn) => {
  return fn.replace(/\.[^.]*$/, "")
}

const rawPartial = (partialName, scriptId) => {
  let partialContent = fs.readFileSync(path.join("views", "partials", partialName + ".hbs"), "utf8")
  partialContent = partialContent.replace(/{[^{]*this\./g, "{") // replace any functions and this.xy -> xy
  return `<script type="text/x-handlebars-template" id="${scriptId}">\n${partialContent}\n</script>`
}

export {
  fn2name,
  rawPartial
}
