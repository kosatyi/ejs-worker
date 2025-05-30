import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { parse } from 'node:path'
import yaml from 'yaml'
import globWatcher from 'glob-watcher'
import fm from 'front-matter'
import { marked } from '../worker/marked.js'
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
    const { attributes: params, body } = fm(file)
    const content = await marked.parse(body)
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

export const parseJSON = (value, defaults) => {
    try {
        return JSON.parse(value)
    } catch (error) {
        return defaults
    }
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

export const fileWatcher = (category, source, callback) => {
    const watcher = globWatcher(source)
    logger.output('🔍', 'watch directory:', source)
    watcher.on('change', async (path) => {
        logger.output('✅', category, 'file change:', path)
        await callback(path, 'change')
    })
    watcher.on('add', async (path) => {
        logger.output('+', category, 'file add:', path)
        await callback(path, 'add')
    })
    watcher.on('unlink', async (path) => {
        logger.output('×', category, 'file remove:', path)
        await callback(path, 'unlink')
    })
    return watcher
}
