import { Marked, Renderer } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'

const contrast = (color) => {
    if (color.slice(0, 1) === '#') {
        color = color.slice(1)
    }
    const r = parseInt(color.slice(0, 2), 16)
    const g = parseInt(color.slice(2, 4), 16)
    const b = parseInt(color.slice(4, 6), 16)
    const yiq = (r * 299 + g * 587 + b * 114) / 1000
    return yiq >= 128 ? '#000000' : '#ffffff'
}

const renderer = new Renderer({})

export const marked = new Marked({
    async: true,
    renderer: {
        table(table) {
            return `<figure class="embed table">${renderer.table.call(this, table)}</figure>`
        },
        image(image) {
            const output = [renderer.image.call(this, image)]
            if (image.title) {
                output.push(`<figcaption>${image.title}</figcaption>`)
            }
            return `<figure class="image">${output.join('')}</figure>\n`
        },
        paragraph({ tokens }) {
            const content = tokens.filter(({ raw }) => raw !== '\n')
            const images = content.filter(({ type }) => type === 'image')
            if (content.length === images.length) {
                const count = images.length
                const output = images.map(this.image.bind(this)).join('\n')
                if (count === 1) return `${output}\n`
                return `<div class="grid grid-${count}">\n${output}\n</div>\n`
            } else {
                return `<p>${this.parser.parseInline(tokens)}</p>\n`
            }
        },
        codespan(codespan) {
            const match = codespan.text.match(/^(#[0-9A-F]{6})$/i)
            if (match) {
                const color = match.at(1)
                return `<span class="hex" style="--t:${contrast(color)};--c:${color};">${color}</span>`
            }
            return renderer.codespan.call(this, codespan)
        },
    },
})

marked.use(
    markedHighlight({
        emptyLangClass: 'hljs',
        langPrefix: 'hljs language-',
        highlight(code, lang, info) {
            const language = hljs.getLanguage(lang) ? lang : 'plaintext'
            return hljs.highlight(code, { language }).value
        },
    }),
)
