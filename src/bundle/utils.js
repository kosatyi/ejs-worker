import { mkdir, readFile, stat, watch, writeFile } from 'node:fs/promises'
import { parse } from 'node:path'
import { Marked } from 'marked'
import fm from 'front-matter'
import yaml from 'yaml'

/**
 * @typedef {function} FileContentBuffer
 * @param {string} path
 * @return {Promise<Buffer<ArrayBufferLike>>}
 */

/**
 * @typedef {function} FileContentString
 * @param path
 * @param {true} stringify
 * @return {Promise<string>}
 */

/**
 * @type {FileContentString | FileContentBuffer}
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

const marked = new Marked({
    async: true,
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
export const fileWatcher = async (source, callback) => {
    const changes = watch(source, { encoding: 'utf-8', recursive: true })
    logger.output('🔍', 'watch directory:', source)
    for await (const item of changes) {
        if (item.filename.endsWith('~')) continue
        await watcherCallback(item.filename, callback, item)
    }
}
