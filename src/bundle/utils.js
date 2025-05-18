import { mkdir, readFile, stat, watch, writeFile } from 'node:fs/promises'
import { parse } from 'node:path'
import { Marked, Renderer } from 'marked'

import fm from 'front-matter'
import yaml from 'yaml'
import globWatcher from 'glob-watcher'

/**
 *
 * @param path
 * @param stringify
 * @returns {Promise<string | Buffer<ArrayBufferLike> | string>}
 */
export const fileContent = (path, stringify = true) => {
    return readFile(path)
        .then((buffer) => (stringify ? buffer.toString() : buffer))
        .catch(() => '')
}

export const fileSave = async (filePath, fileData) => {
    await mkdir(parse(filePath).dir, { recursive: true })
    await writeFile(filePath, fileData)
    return filePath
}

export const jsonFileSave = async (filePath, fileData, replacer, space) => {
    const fileContent = JSON.stringify(fileData, replacer, space)
    await fileSave(filePath, fileContent)
    return filePath
}

const renderer = new Renderer()
const marked = new Marked({
    async: true,
    renderer: {
        table(...args) {
            return `<figure class="embed table">${renderer.table.apply(this, args)}</figure>`
        },
    },
    hooks: {
        processAllTokens(tokens) {
            return tokens
        },
        preprocess(markdown) {
            const { attributes, body } = fm(markdown)
            this.params = attributes
            return body
        },
        postprocess(html) {
            return { params: this.params, content: html }
        },
    },
})

function contrast(hexcolor) {
    if (hexcolor.slice(0, 1) === '#') {
        hexcolor = hexcolor.slice(1)
    }
    const r = parseInt(hexcolor.slice(0, 2), 16)
    const g = parseInt(hexcolor.slice(2, 4), 16)
    const b = parseInt(hexcolor.slice(4, 6), 16)
    const yiq = (r * 299 + g * 587 + b * 114) / 1000
    return yiq >= 128 ? '#000000' : '#ffffff'
}

marked.use({
    extensions: [
        {
            name: 'codespan',
            level: 'inline',
            tokenizer(str) {
                const match = str.match(/^`(#[0-9A-F]{6})`/i)
                if (match) {
                    const [raw, text] = match
                    return {
                        type: 'codespan',
                        raw,
                        text,
                        color: text.toUpperCase(),
                    }
                }
                return false
            },
            renderer({ text, color }) {
                if (color) {
                    return `<mark style="--t:${contrast(color)};--c:${color};"><code>${text}</code></mark>`
                }
                return `<span><code>${text}</code></span>`
            },
        },
    ],
})

const getFileData = async (filepath) => {
    const { mtime: modifiedAt, ctime: createdAt } = await stat(filepath)
    return {
        modifiedAt,
        createdAt,
    }
}

export const trimContent = (content) => {
    return String(content).trim()
}

export const parseMarkdown = async (filepath) => {
    const data = await getFileData(filepath)
    const file = await fileContent(filepath)
    const { params, content } = await marked.parse(file)
    Object.assign(data, params)
    return { data, content }
}

export const parseYaml = async (filepath) => {
    const data = await getFileData(filepath)
    const file = await fileContent(filepath, true)
    const content = yaml.parse(file)
    Object.assign(data, { content })
    return { data }
}

export const parseHtml = async (filepath) => {
    const data = await getFileData(filepath)
    const file = await fileContent(filepath)
    const { attributes, body } = fm(file)
    Object.assign(data, attributes)
    return { data, content: trimContent(body) }
}

export const parseImage = async (filepath) => {
    const data = await getFileData(filepath)
    const content = await fileContent(filepath, false)
    return { data, content, buffer: true }
}

export const parsePdf = async (filepath) => {
    const data = await getFileData(filepath)
    const content = await fileContent(filepath, false)
    return { data, content, buffer: true }
}

export const parseBuffer = async (filepath) => {
    const data = await getFileData(filepath)
    const content = await fileContent(filepath, false)
    return { data, content, buffer: true }
}

export const spinner = {
    index: 0,
    chars: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
    rotate() {
        return this.chars[this.index++] || this.chars[(this.index = 0)]
    },
}

export const logger = {
    time(label, state) {
        console[state ? 'time' : 'timeEnd'](label)
    },
    output(...args) {
        process.stdout.write(args.join(' ').concat('\n'))
    },
    progress(category, value) {
        process.stdout.clearLine(0)
        process.stdout.cursorTo(0)
        if (category && value) {
            process.stdout.write(
                [spinner.rotate(), category, String(value)].join(' '),
            )
        }
    },
}

export const arrayAsync = (arrayLike, callback) => {
    return Promise.all(Array.from(arrayLike).map(callback))
}

export const parseJSON = (value, defaults) => {
    try {
        return JSON.parse(value)
    } catch (error) {
        return defaults
    }
}

const watcherPromise = {}
const watcherTimeout = 100
const watcherCallback = (id, callback, context) => {
    clearTimeout(watcherPromise[id])
    return new Promise((resolve) => {
        watcherPromise[id] = setTimeout(
            async ({ filename }) => {
                logger.output('✅', 'file change:', filename)
                await callback(filename)
                resolve()
            },
            watcherTimeout,
            context,
        )
    })
}
export const fileWatcher = (category, source, callback) => {
    const watcher = globWatcher(source)
    logger.output('🔍', 'watch directory:', source)
    watcher.on('change', async (path) => {
        logger.output('✅', 'file change:', path)
        await callback(path)
    })
    watcher.on('add', async (path) => {
        logger.output('+', 'file add:', path)
        await callback(path)
    })
    watcher.on('unlink', async (path) => {
        logger.output('×', 'file unlink:', path)
        await callback(path)
    })
    return watcher
}
