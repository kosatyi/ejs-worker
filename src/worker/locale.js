import { isPlainObject } from './utils.js'
//
const collection = 'i18n'
const i18nData = { en: {} }
const i18nInstance = { default: 'en', current: 'en' }
/**
 *
 * @param prop
 * @param params
 * @return {string}
 */
export const i18n = (prop, params) => {
    if (typeof prop !== 'string') return
    const data = i18nData[i18nInstance.current] || {}
    const value = data[prop] || prop
    return value.replace(/{([^}]+)}/g, (m, n) =>
        typeof params[n] !== undefined ? params[n] : n,
    )
}
/**
 *
 * @param lang
 * @return {boolean}
 */
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

i18n.init = (list = []) => {
    if (Array.isArray(list) === false) return
    list.forEach(({ name, data: { lang, content } = {} }) => {
        if (name === collection) {
            i18n.add(lang, content)
        }
    })
}

i18n.use = () => {
    return async (context, next) => {
        context.i18n = i18n
        await next()
    }
}
