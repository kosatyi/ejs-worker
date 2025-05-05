import * as marked from 'marked'
import { helpers } from '@kosatyi/ejs/worker'
import { i18n } from './locale.js'
import { splitPath } from './utils.js'

/**
 * @namespace EJS
 */
helpers({
    truncate(prop, length) {
        return this.get(prop, prop).slice(0, length)
    },
    capitalize(prop) {
        prop = this.get(prop, prop)
        return String(prop).charAt(0).toUpperCase() + String(prop).slice(1)
    },
    url(path, query) {
        const url = URL.parse(this.get('origin'))
        url.pathname = splitPath(path).join('/')
        Object.entries(query || {}).forEach(([key, value]) => {
            url.searchParams.set(key, String(value))
        })
        return url.toString()
    },
    assets(path, nocache) {
        return this.url(
            splitPath(path),
            nocache ? { v: this.get('version') } : {},
        )
    },
    ln(path, query) {
        const lang = this.get('lang')
        path = splitPath(path)
        if (lang && i18n.has(path.at(0)) === false) {
            path.unshift(lang)
        }
        return this.url(path, query)
    },
    format(pattern, props) {
        return pattern.replace(/{([^}]+)}/g, (m, n) =>
            typeof props[n] !== undefined ? props[n] : n,
        )
    },
    link(pattern, props) {
        return this.url(this.format(pattern, this.get(props, {})))
    },
    markdown(prop) {
        prop = this.get(prop, prop)
        return prop ? marked.parse(prop) : ''
    },
    jsonGraph(value) {
        const list = this.get('graph', [])
        const { '@type': schemaType } = value
        const index = list.findIndex(
            ({ '@type': itemType }) => schemaType === itemType,
        )
        const exist = !!~index
        const item = exist ? list.at(index) : {}
        const schema = Object.assign({}, item || {}, value)
        if (exist) {
            list.splice(index, 1, schema)
        } else {
            list.push(schema)
        }
        this.set('graph', list)
    },
    itemListElement(list) {
        return list.map(([url, name], index) => {
            return {
                '@type': 'ListItem',
                position: index + 1,
                item: { '@id': url, name },
            }
        })
    },
})
