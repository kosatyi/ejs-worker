import { helpers } from '@kosatyi/ejs/worker'

const filters = {
    $eq(name, value) {
        return (item) => getPath(item, name, '') === value
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

const isPlainObject = (v) => v && v.constructor === Object
const isRegexp = (v) => v && v.constructor === RegExp
const isArray = (v) => Array.isArray(v)
const hasOwn = (o, v) => Object.hasOwn(o, v)
const isFunction = (v) => typeof v === 'function'
const firstPropKey = (o) => Object.keys(o)[0]

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

export const getPath = (context, name, defaults) => {
    let data = context || {}
    let chunks = String(name).split('.')
    let prop = chunks.pop()
    data = chunks.reduce((d, p, i, a) => {
        if (Object.hasOwn(d, p) === false) return a.splice(1)
        return d[p]
    }, data)
    return Object.hasOwn(data, prop) ? data[prop] : defaults
}

const getPages = (total, current, limit) => {
    current = Number(current) || 1
    limit = Number(limit) || 1e2
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

export const api = (() => {
    const props = {
        name: 'assets',
        path: '/data/',
        context: {},
        data: [],
    }
    const getCursor = (query) => {
        return query
            .map(([name, value]) => getFilter(name, value))
            .filter((filter) => filter)
            .reduce((a, c) => a.filter(c), props.data)
    }

    const getPath = (...path) => {
        return path
            .map((i) => (i ? i.split('/') : null))
            .flat()
            .filter((i) => i)
            .join('/')
    }

    return {
        setProps(extend = {}) {
            Object.assign(props, extend)
            return this
        },
        async getContent({ path }) {
            const {
                req: { url },
                env: { [props.name]: assets },
            } = props.context
            const file = URL.parse(url)
            file.pathname = path
            return assets.fetch(file).then((res) => res.json())
        },
        findOne({ query = [], sort = [] }) {
            return getCursor(query).at(0)
        },
        find({ query = [], sort = [], page = 1, limit = 10 }) {
            const cursor = getCursor(query)
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
        },
    }
})()

/**
 * @namespace EJS
 */
helpers({ api })

export const setApi = ({ path, data = [] }) => {
    api.setProps({ data, path })
    return async (context, next) => {
        api.setProps({ context })
        context.api = api
        await next()
    }
}

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
