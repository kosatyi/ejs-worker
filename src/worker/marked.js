import { Marked, Renderer } from 'marked'

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

const renderer = new Renderer({
    renderer: {
        figure(image) {
            const output = [renderer.image(image)]
            if (image.title) {
                output.push(`<figcaption>${image.title}</figcaption>`)
            }
            return `<figure class="image">${output.join('')}</figure>`
        },
    },
})

export const marked = new Marked({
    async: true,
    renderer: {
        table(table) {
            return `<figure class="embed table">${renderer.table.call(this, table)}</figure>`
        },
        paragraph({ tokens }) {
            const content = tokens.filter(({ raw }) => raw !== '\n')
            const images = content.filter(({ type }) => type === 'image')
            if (content.length === images.length) {
                const output = images.map(this.image.bind(this)).join('\n')
                return `<figure class="image" data-grid="${images.length}">\n${output}\n</figure>\n`
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
