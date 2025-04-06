import { resolve } from 'node:path'
import { glob } from 'glob'
import {
    arrayAsync,
    fileContent,
    jsonFileSave,
    fileWatcher,
    parseJSON,
} from './utils.js'

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
            const path = resolve(target, [lang, 'json'].join('.'))
            const content = await fileContent(path)
            this.data[lang] = parseJSON(content, {})
        }
    }
    async build() {
        const { source, types, exclude } = this.options
        if (typeof source !== 'string') return
        const ignore = ['node_modules/**'].concat(exclude)
        const files = await glob(`**/*.{${types.join(',')}}`, {
            cwd: source,
            ignore,
        })
        const list = Array.from(files)
        for (const filename of list) {
            await this.process(filename)
        }
        await this.save()
    }
    async watch() {
        const watchers = []
        watchers.push(
            fileWatcher(
                this.options.target,
                async () => {
                    await this.setup()
                },
                250,
            ),
        )
        watchers.push(
            fileWatcher(
                this.options.source,
                async (filename) => {
                    await this.process(filename)
                    await this.save()
                },
                250,
            ),
        )
        await Promise.all(watchers)
    }
    async process(file) {
        const { source, names } = this.options
        const regexp = new RegExp(
            `(?:${names.join('|')})(?:\\(|\\s)(["'])(.+?)\\1`,
            'g',
        )
        const content = await fileContent(resolve(source, file))
        const matches = content.matchAll(regexp)
        for (const item of matches) {
            this.define(item.at(2))
        }
    }
    async save() {
        const { target } = this.options
        await arrayAsync(Object.entries(this.data), ([lang, data]) => {
            const file = resolve(target, [lang, 'json'].join('.'))
            console.log('✅', 'save file:', file)
            return jsonFileSave(file, data, null, 2)
        })
    }
}
