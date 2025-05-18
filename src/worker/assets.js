import { helpers } from '@kosatyi/ejs/worker'

const isPlainObject = (v) => v && v.constructor === Object
const isRegexp = (v) => v && v.constructor === RegExp
const isArray = (v) => Array.isArray(v)
const hasOwn = (o, v) => Object.hasOwn(o, v)
const isFunction = (v) => typeof v === 'function'
const firstPropKey = (o) => Object.keys(o)[0]

const filters = {
    $eq(name, value) {
        return (item) => getPath(item, name, '') === value
    },
    $ne(name, value) {
        return (item) => getPath(item, name, '') !== value
    },
    $startWith(name, value) {
        return (item) => getPath(item, name, '').startsWith(value)
    },
    $contains(name, value) {
        return (item) => !!~getPath(item, name, '').indexOf(value)
    },
    $in(name, value) {
        return (item) => value.includes(getPath(item, name, ''))
    },
    $nin(name, value) {
        return (item) => !value.includes(getPath(item, name, ''))
    },
    $gt(name, value) {
        return (item) => getPath(item, name, '') > value
    },
    $gte(name, value) {
        return (item) => getPath(item, name, '') >= value
    },
    $lt(name, value) {
        return (item) => getPath(item, name, '') < value
    },
    $lte(name, value) {
        return (item) => getPath(item, name, '') <= value
    },
    $regex(name, value) {
        return (item) => value.test(getPath(item, name, ''))
    },
}

const operators = {
    $or(list) {
        return (item) =>
            list.some(([name, value]) => getFilter(name, value)(item))
    },
    $and(list) {
        return (item) =>
            list.every(([name, value]) => getFilter(name, value)(item))
    },
}

const getFilterType = (params) => {
    let key = '$eq'
    let value = params
    if (isPlainObject(params)) {
        key = firstPropKey(params)
        value = params[key]
    } else if (isRegexp(params)) {
        key = '$regex'
    }
    return [key, value]
}

const getFilter = (name, params) => {
    if (hasOwn(operators, name) && isArray(params)) {
        if (isFunction(operators[name])) return operators[name](params)
        throw new Error(`Login operator "${name}" is not a function`)
    }
    const [key, value] = getFilterType(params)
    if (hasOwn(filters, key) && isFunction(filters[key])) {
        return filters[key](name, value)
    }
    throw new Error(`Filter operator "${key}" is not a function`)
}

const getPath = (context, name, defaults) => {
    let data = context || {}
    let chunks = String(name).split('.')
    let prop = chunks.pop()
    data = chunks.reduce((d, p, i, a) => {
        if (Object.hasOwn(d, p) === false) return a.splice(1)
        return d[p]
    }, data)
    return Object.hasOwn(data, prop) ? data[prop] : defaults
}

const getSort = (list) => {
    return (a, b) => {
        return list
            .map(([n, o]) => {
                const af = getPath(a, n)
                const bf = getPath(b, n)
                if (af > bf) return o
                if (af < bf) return -o
                return 0
            })
            .reduce((p, n) => (p ? p : n), 0)
    }
}

const getPages = (total, current, limit) => {
    current = Number(current) || 1
    limit = Number(limit) || 1e3
    let count = Math.ceil(total / limit)
    let index = Math.max(1, current - 1)
    let start = current === 1 ? 0 : index * limit
    let end = start + limit
    let previous = current > 1 ? current - 1 : null
    let next = current < count ? current + 1 : null
    return {
        current,
        previous,
        next,
        count,
        start,
        end,
    }
}

export class Api {
    #defaultProps = {
        name: 'assets',
        path: '/data/',
        context: {},
        data: [],
        index: {},
    }
    #props = {}
    constructor() {
        this.#props = Object.assign({}, this.#defaultProps)
    }
    #cursor(query = [], index) {
        const data = this.#props.index[index] ?? this.#props.data
        return query
            .map(([name, value]) => getFilter(name, value))
            .filter((filter) => filter)
            .reduce((a, c) => a.filter(c), data)
    }
    props(extend = {}) {
        Object.assign(this.#props, extend)
        return this
    }
    index(name, query) {
        this.#props.index[name] = this.#cursor(query)
        return this
    }
    async getContent({ path }) {
        const {
            req: { url },
            env: { [this.#props.name]: assets },
        } = this.#props.context
        const file = URL.parse(url)
        file.pathname = path
        return assets.fetch(file).then((res) => res.json())
    }
    findOne({ query = [], sort = [], index = undefined }) {
        return this.#cursor(query, index).sort(getSort(sort)).at(0)
    }
    /**
     *
     * @param {any[]} query
     * @param {any[]} sort
     * @param {string|number} page
     * @param {string|number} limit
     * @param {string} [index]
     * @returns {{total: number, count: number, pages: Omit<{current: number | number, previous: number, next: *, count: number, start: (number|number), end: *}, "start"|"end">, list: (*)[]}}
     */
    find({ query = [], sort = [], page = 1, limit = 1e3, index = undefined }) {
        const cursor = this.#cursor(query, index)
        const total = cursor.length
        const { start, end, ...pages } = getPages(total, page, limit)
        const list = cursor.sort(getSort(sort)).slice(start, end)
        const count = list.length
        return {
            total,
            count,
            pages,
            list,
        }
    }
}

const api = new Api()

/**
 * @namespace EJS
 */
helpers({
    api,
})
/**
 *
 * @param path
 * @param data
 * @return {(function(*, *): Promise<void>)|*}
 */
export const setApi = ({ path, data = [] }) => {
    api.props({ data, path })
    return async (context, next) => {
        api.props({ context })
        context.api = api
        await next()
    }
}
/**
 *
 * @param props
 * @return {(function(*, *): Promise<void>)|*}
 */
export const setData = (props = {}) => {
    return async (context, next) => {
        if (context.data) {
            Object.entries(props).forEach(([key, value]) => {
                context.data.set(key, value)
            })
        }
        await next()
    }
}
