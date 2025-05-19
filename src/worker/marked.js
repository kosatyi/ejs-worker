import { Marked, Renderer } from 'marked'
import fm from 'front-matter'

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

const renderer = new Renderer()

export const marked = new Marked({
    async: true,
    renderer: {
        table(...args) {
            return `<figure class="embed table">${renderer.table.apply(this, args)}</figure>`
        },
        image(...args) {
            console.log('image', args)
            return `<figure class="image">${renderer.image.apply(this, args)}</figure>`
        },
        paragraph(...args) {
            console.log('paragraph', args)
            return renderer.paragraph.apply(this, args)
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

marked.use({
    extensions: [
        {
            name: 'codespan',
            level: 'inline',
            tokenizer(str) {
                const hex = str.match(/^`(#[0-9A-F]{6})`/i)
                if (hex) {
                    const [raw, text] = hex
                    return {
                        type: 'codespan',
                        raw,
                        text,
                        hex: text.toUpperCase(),
                    }
                }
                return false
            },
            renderer({ text, hex }) {
                if (hex) {
                    return `<mark style="--t:${contrast(hex)};--c:${hex};"><code>${text}</code></mark>`
                }
                return `<span><code>${text}</code></span>`
            },
        },
    ],
})
