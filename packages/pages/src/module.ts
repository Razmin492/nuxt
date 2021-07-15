import { existsSync } from 'fs'
import { defineNuxtModule } from '@nuxt/kit'
import { resolve } from 'upath'
import { resolveLayouts, resolvePagesRoutes } from './utils'

export default defineNuxtModule({
  name: 'router',
  setup (_options, nuxt) {
    const runtimeDir = resolve(__dirname, 'runtime')
    const pagesDir = resolve(nuxt.options.srcDir, nuxt.options.dir.pages)
    const routerPlugin = resolve(runtimeDir, 'router')

    nuxt.hook('builder:watch', async (event, path) => {
      // Regenerate templates when adding or removing pages (plugin and routes)
      const pathPattern = new RegExp(`^(${nuxt.options.dir.pages}|${nuxt.options.dir.layouts})/`)
      if (event !== 'change' && path.match(pathPattern)) {
        await nuxt.callHook('builder:generateApp')
      }
    })

    nuxt.hook('app:resolve', (app) => {
      if (!existsSync(pagesDir)) {
        return
      }
      app.plugins.push({ src: routerPlugin })
      if (app.main.includes('app.tutorial')) {
        app.main = resolve(runtimeDir, 'app.vue')
      }
    })

    nuxt.hook('app:templates', async (app) => {
      if (!existsSync(pagesDir)) {
        return
      }

      // Resolve routes
      const routes = await resolvePagesRoutes(nuxt)

      // Add routes.js
      app.templates.push({
        path: 'routes.js',
        compile: () => {
          const serializedRoutes = routes.map(route => ({ ...route, component: `{() => import('${route.file}')}` }))
          return `export default ${JSON.stringify(serializedRoutes, null, 2).replace(/"{(.+)}"/g, '$1')}`
        }
      })

      const layouts = await resolveLayouts(nuxt)

      // Add routes.js
      app.templates.push({
        path: 'layouts.js',
        compile: () => {
          const layoutsObject = Object.fromEntries(layouts.map(({ name, file }) => {
            return [name, `{defineAsyncComponent({ suspensible: false, loader: () => import('${file}') })}`]
          }))
          return [
            'import { defineAsyncComponent } from \'vue\'',
            `export default ${JSON.stringify(layoutsObject, null, 2).replace(/"{(.+)}"/g, '$1')}
          `].join('\n')
        }
      })
    })
  }
})