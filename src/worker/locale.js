import { helpers } from '@kosatyi/ejs/worker'

const i18nData = {
    en: {},
}
const i18nInstance = {
    default: 'en',
}

const isPlainObject = (value) => value?.constructor === Object

export const i18n = (prop, params) => {
    if (typeof prop !== 'string') return
    const data = i18nData[i18nInstance.current] || {}
    const value = data[prop] || prop
    return value.replace(/{([^}]+)}/g, (m, n) =>
        typeof params[n] !== undefined ? params[n] : n,
    )
}

i18n.has = (lang) => {
    return i18nData.hasOwnProperty(lang)
}

i18n.lang = (lang) => {
    i18nInstance.current = lang
}

i18n.keys = () => {
    return Object.keys(i18nData)
}

i18n.add = (lang, data) => {
    if (i18nData.hasOwnProperty(lang) === false) {
        i18nData[lang] = {}
    }
    if (isPlainObject(data)) {
        Object.entries(data).forEach(([key, value]) => {
            if (value) {
                i18nData[lang][key] = value
            }
        })
    }
    return i18n
}
/**
 * @namespace EJS
 */
helpers({ i18n })
/**
 * @param {Object<string,any>} options
 * @return {(function(c:Context, next): Promise<any>)|*}
 */
export const setLocale = ({ data = {} } = {}) => {
    Object.entries(data).forEach(([key, value]) => {
        i18n.add(key, value)
    })
    return async (context, next) => {
        context.i18n = i18n
        await next()
    }
}
