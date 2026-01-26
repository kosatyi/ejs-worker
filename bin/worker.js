#! /usr/bin/env node

import argv from 'process.argv'
import path from 'path'

import { access, constants } from 'node:fs/promises'

import { Bundler } from '@kosatyi/ejs/bundler'

import { EjsLocale, EjsContent } from '../bundle.js'

const schema = argv(process.argv.slice(2))

const arrayLike = (value) => (Array.isArray(value) ? value : [value])

const watchers = []

const params = schema({
    config: 'ejs.config.js',
})

if (typeof params.config !== 'string') {
    throw new Error('config is not defined')
}

const configPath = path.join(process.cwd(), params.config)
const configExist = await access(configPath, constants.F_OK)
    .then(() => true)
    .catch(() => false)

if (!configExist) {
    throw new Error(`cant access to config file ${configPath}`)
}

const {
    default: ejsConfig,
    contentConfig,
    localeConfig,
} = await import(configPath)

await Promise.all(
    arrayLike(ejsConfig).map(async (config) => {
        if (typeof config == 'undefined') return
        if (typeof config.target !== 'string') return
        const ejsConfig = Object.assign(
            {
                target: null,
                umd: false,
                withObject: false,
                export: 'ejsPrecompiled',
                path: 'views',
                extension: 'ejs',
            },
            config,
        )
        const bundler = Bundler(
            {
                target: ejsConfig.target,
                minify: ejsConfig.minify,
                umd: ejsConfig.umd,
            },
            {
                withObject: ejsConfig.withObject,
                path: ejsConfig.path,
                export: ejsConfig.export,
                extension: ejsConfig.extension,
            },
        )
        await bundler.build()
        if (params.watch) {
            watchers.push(bundler.watch())
        }
    }),
)

if (contentConfig) {
    const content = new EjsContent(contentConfig)
    await content.build()
    if (params.watch) {
        watchers.push(content.watch())
    }
}

if (localeConfig) {
    const locale = new EjsLocale(localeConfig)
    await locale.setup()
    await locale.build()
    if (params.watch) {
        watchers.push(locale.watch())
    }
}

await Promise.all(watchers)
