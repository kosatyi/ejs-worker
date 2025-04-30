export const splitPath = (path) => {
    path = Array.isArray(path) ? path : (path || '').split('/')
    return path.filter((i) => i)
}
export const isPlainObject = (value) => value?.constructor === Object
