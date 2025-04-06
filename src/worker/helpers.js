import { helpers, version } from '@kosatyi/ejs/worker'
import { i18n } from './locale.js'

const trimTrailingSlash = (path) => {
    if (path.at(-1) === '/') {
        path = path.substring(0, path.length - 1)
    }
    return path
}

const appendTrailingSlash = (path) => {
    if (path.at(-1) !== '/') {
        path.split('/').at(-1).split('.')
    }
}

const splitPath = (path) =>
    (Array.isArray(path) ? path : (path || '').split('/')).map((i) => i)

/**
 * @namespace EJS
 */
helpers({
    trailingSlash(path) {
        return path
    },
    url(path, query) {
        const url = new URL(this.get('origin'))
        path = splitPath(path).join('/')
        url.pathname = this.trailingSlash(path)
        Object.entries(query || {}).forEach(([key, value]) => {
            url.searchParams.set(key, String(value))
        })
        return url.toString()
    },
    assets(path, nocache) {
        return this.url(splitPath(path), nocache ? { v: version } : {})
    },
    ln(path, query) {
        path = splitPath(path)
        if (i18n.has(path.at(0)) === false) path.unshift(this.get('lang'))
        return this.url(path, query)
    },
})
