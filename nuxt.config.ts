// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  devtools: { enabled: false },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'Ark servers · Arké',
      meta: [
        { name: 'description', content: 'Public Ark servers you can use with Arké, with observed uptime and advertised fees.' },
        { name: 'color-scheme', content: 'light dark' },
      ],
    },
  },
  nitro: {
    prerender: { routes: ['/', '/servers.json'] },
  },
})
