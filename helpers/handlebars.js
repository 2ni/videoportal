const fn2name = (fn) => {
  return fn.replace(/\.[^.]*$/, "")
}

export {
  fn2name
}
