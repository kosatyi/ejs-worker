import { resolve } from 'node:path'
import { glob, Glob } from 'glob'
import yaml from 'yaml'
import {
    arrayAsync,
    fileContent,
    fileWatcher,
    fileSave,
    logger,
} from './utils.js'
import globWatcher from 'glob-watcher'

export class EjsLocale {
    constructor(options = {}) {
        this.data = {}
        this.options = Object.assign(
            {
                source: null,
                output: ['en', 'uk'],
                target: 'i18n',
                names: ['_', 'i18n'],
                types: ['ejs', 'js'],
                exclude: [],
            },
            options,
        )
    }
    sort(data) {
        return Object.keys(data)
            .sort()
            .reduce((obj, key) => {
                obj[key] = data[key]
                return obj
            }, {})
    }
    reduce(callback) {
        Object.entries(this.data).reduce((data, [lang, value]) => {
            data[lang] = callback(lang, value, data)
            return data
        }, this.data)
    }
    define(prop) {
        this.reduce((lang, value) => {
            value[prop] = value[prop] || ''
            return value
        })
    }
    async setup() {
        const { target, output } = this.options
        for (const lang of output) {
            const path = resolve(target, [lang, 'yml'].join('.'))
            const content = await fileContent(path, true)
            const data = yaml.parse(content)
            this.data[lang] = {}
            Object.assign(this.data[lang], data || {})
        }
    }
    async build() {
        const { source, types, exclude } = this.options
        if (typeof source !== 'string') return
        const ignore = ['node_modules/**'].concat(exclude)
        const pattern = Array.isArray(source) ? source : [source]
        const wildcard = `**/*.{${types.join(',')}}`
        const match = pattern.map((item) => [item, wildcard].join('/'))
        const files = await glob(match, { ignore })
        const list = Array.from(files)
        for (const filename of list) {
            await this.process(filename)
        }
        await this.save()
    }
    async watch() {
        const { source, target } = this.options
        fileWatcher('i18n', source, async (path) => {
            await this.process(path)
            await this.save()
        })
        fileWatcher('i18n', target, async () => {
            await this.setup()
        })
    }
    async process(file) {
        const { names } = this.options
        const regexp = new RegExp(
            `(?:${names.join('|')})(?:\\(|\\s)(["'])(.+?)\\1`,
            'g',
        )
        const content = await fileContent(file)
        const matches = content.matchAll(regexp)
        for (const item of matches) {
            this.define(item.at(2))
        }
    }
    async save() {
        const { target } = this.options
        await arrayAsync(Object.entries(this.data), ([lang, data]) => {
            const file = resolve(target, [lang, 'yml'].join('.'))
            logger.output('✅', 'save file:', file)
            return fileSave(file, yaml.stringify(this.sort(data)))
        })
    }
}
