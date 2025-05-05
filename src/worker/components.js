import { element } from '@kosatyi/ejs/element'
import { helpers } from '@kosatyi/ejs/worker'
import { configureComponent, getComponent, Component } from 'ejs-component'

configureComponent({
    tagNodeToString({ tag, attrs, content }) {
        return element(tag, attrs, content)
    },
})

/**
 * @namespace EJS
 */
helpers({
    /**
     * @memberof global
     * @param {string} name
     * @param {{}} props
     * @param {any} [content]
     */
    ui(name, props, content) {
        const component = getComponent(name)
        if (component) {
            this.echo(component(props, content))
        }
    },
})
