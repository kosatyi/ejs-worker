import { helpers, version } from '@kosatyi/ejs/worker'
const i18n = ['en', 'uk']
const splitPath = (path) => {
    path = Array.isArray(path) ? path : (path || '').split('/')
    return path.filter((i) => i)
}
/**
 * @namespace EJS
 */
helpers({
    url(path, query) {
        const url = URL.parse(this.get('origin'))
        url.pathname = splitPath(path).join('/')
        Object.entries(query || {}).forEach(([key, value]) => {
            url.searchParams.set(key, String(value))
        })
        return url.toString()
    },
    assets(path, nocache) {
        return this.url(splitPath(path), nocache ? { v: version } : {})
    },
    ln(path, query) {
        const lang = this.get('lang')
        path = splitPath(path)
        if (lang && i18n.includes(path.at(0)) === false) {
            path.unshift(lang)
        }
        return this.url(path, query)
    },
})
