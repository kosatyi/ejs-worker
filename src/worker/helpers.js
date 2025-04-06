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

/**
 * @namespace EJS
 */
helpers({
    trailingSlash(path) {
        return path
    },
    url(path, query) {
        const url = new URL(this.get('origin'))
        if (Array.isArray(path)) {
            path = path.filter((i) => i).join('/')
        }
        url.pathname = this.trailingSlash(path)
        Object.entries(query || {}).forEach(([key, value]) => {
            url.searchParams.set(key, String(value))
        })
        return url.toString()
    },
    assets() {
        let query = {}
        let path = Array.from(arguments)
        let nocache = path.pop()
        if (nocache === true) {
            query.v = version
        } else {
            path.push(nocache)
        }
        return this.url(path, query)
    },
    ln() {
        let { locale } = this
        let args = Array.from(arguments).map((i) => i)
        let path = Array.from(arguments)
        let lang = args.shift()
        let query = args.pop()
        if (query && typeof query === 'string') query = {}
        if (i18n.has(lang) === false) path.unshift(locale)
        return this.url(path, query)
    },
})
