const timestamp = () => {
  const tzoffset = (new Date()).getTimezoneOffset() * 60000 // offset in ms
  return (new Date(Date.now() - tzoffset)).toISOString().slice(0,19).replace(/T/, " ")
}

const capitalize = (str) => {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

const getBreadcrumbs = (req, res, next) => {
  const urls = req.originalUrl.split('/')
  if (urls[1] == "") {
    urls.shift()
  }
  res.locals.breadcrumbs = urls.map((url, i) => {
    return {
      name: url === "" ? "Home" : capitalize(url),
      url: `/${urls.slice(1, i + 1).join("/")}`
    }
  })
  next()
}

export {
  timestamp,
  capitalize,
  getBreadcrumbs,
}
