import { glob } from 'glob'
import { extname, resolve, join, relative } from 'node:path'
import {
    logger,
    fileSave,
    jsonFileSave,
    parseHtml,
    parseMarkdown,
    parseYaml,
    parseBuffer,
    arrayAsync,
} from './utils.js'
import globWatcher from 'glob-watcher'

export class EjsContent {
    constructor(options = {}) {
        this.options = Object.assign(
            {
                i18n: {},
                fileTypes: ['md', 'yml', 'html', 'pdf', 'svg', 'png', 'jpg'],
                collections: [],
            },
            options,
        )
        this.pipe = new Set()
        this.site = new Map()
        this.data = new Map()
        this.#setup()
    }

    #setup() {
        const { collections } = this.options
        if (Array.isArray(collections)) {
            collections.forEach((collection) => {
                this.add(collection)
            })
        }
    }

    add({
        name,
        regexp,
        output,
        source,
        target,
        index,
        dataCallback,
        contentCallback,
    }) {
        if (!name || !regexp || !output) throw new Error('parameters mismatch')
        target = target || this.options.target
        source = source || this.options.source
        regexp = new RegExp(regexp, 'iu')
        dataCallback = dataCallback || (($data) => $data)
        contentCallback = contentCallback || (($content) => $content)
        this.pipe.add({
            name,
            regexp,
            output,
            source,
            target,
            index,
            dataCallback,
            contentCallback,
        })
        return this
    }

    config(filename) {
        return Array.from(this.pipe).find(({ regexp }) => regexp.test(filename))
    }

    params(regexp, string) {
        string = string.toLowerCase().replace(/['\s]/g, '')
        const { groups } = regexp.exec(string) || {}
        return groups || null
    }

    format(pattern, params) {
        const regexp = /:([a-z]+)/g
        pattern = pattern
            .split('/')
            .filter((path) => {
                const props = path.match(regexp)
                if (props === null) return true
                return props.every((v) => params[v.slice(1)])
            })
            .join('/')
        return pattern.replace(regexp, (match, key) => {
            if (Object.hasOwn(params, key)) {
                return params[key]
            } else {
                throw Error('key not in params: ' + key)
            }
        })
    }

    async watch() {
        const sourceWatcher = globWatcher(this.options.source)
        const sourceChange = async (path) => {
            path = relative(this.options.source, path)
            const config = this.config(path)
            if (config) {
                await this.parse([path], config)
                await this.saveIndex()
            }
        }
        sourceWatcher.on('change', sourceChange)
        sourceWatcher.on('add', sourceChange)
        sourceWatcher.on('add', sourceChange)
    }

    async pipeline() {
        const files = await this.files()
        return arrayAsync(this.pipe, (config) => this.parse(files, config))
    }

    async files() {
        const { source: cwd, fileTypes } = this.options
        const pattern = `**/*.{${fileTypes.join(',')}}`
        const files = await glob(pattern, { cwd })
        return Array.from(files)
    }

    async build() {
        logger.time('🕑 parse time', true)
        await this.pipeline()
        await this.saveIndex()
        logger.progress(null)
        logger.time('🕑 parse time', false)
        logger.output('🗎 file count:', this.site.size)
    }

    async saveData(name, list) {
        const { target } = this.options
        await jsonFileSave(
            [target, 'api', [name, 'json'].join('.')].join('/'),
            list.map(({ name, path, data }) => ({ name, path, data })),
        )
    }

    async saveIndex() {
        const list = Array.from(this.site.values())
        return this.saveData('index', list)
    }

    async content(file) {
        file = resolve(file)
        switch (extname(file)) {
            case '.md':
                return parseMarkdown(file)
            case '.yml':
                return parseYaml(file)
            case '.html':
                return parseHtml(file)
        }
        return parseBuffer(file)
    }

    async parse(
        files,
        {
            name,
            regexp,
            output,
            source,
            target,
            dataCallback,
            contentCallback,
            index = true,
        },
    ) {
        const collection = this.data.get(name) || new Map()
        this.data.set(name, collection)
        for (const filename of files) {
            let filepath = resolve(source, filename)
            let params = this.params(regexp, filename)
            if (params === null) {
                this.site.delete(filepath)
                collection.delete(filepath)
                continue
            }
            let { data, content, buffer } = await this.content(filepath)
            if (data === null) {
                this.site.delete(filepath)
                collection.delete(filepath)
                continue
            }
            dataCallback(Object.assign(data, params))
            let path = this.format(output, data)
            content = contentCallback(content)
            const entry = { name, path, data, content }
            if (index) {
                this.site.set(filepath, entry)
            }
            collection.set(filepath, entry)
            if (buffer) {
                await fileSave(join(target, path), content)
            } else {
                await jsonFileSave(join(target, path), entry)
            }
            logger.progress('save file:', path)
        }
        await this.saveData(name, Array.from(collection.values()))
        logger.progress(null)
    }
}
