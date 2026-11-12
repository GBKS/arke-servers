// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  devtools: { enabled: false },
  css: ['~/assets/main.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'Ark(é) Servers',
      meta: [
        { name: 'description', content: 'Public Ark servers you can use with Arké, with observed uptime and advertised fees.' },
        { name: 'color-scheme', content: 'dark' },
        { name: 'theme-color', content: '#170B00' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Serif+Display&family=Inter:wght@400;500;600&display=swap' },
      ],
    },
  },
  nitro: {
    prerender: { routes: ['/', '/servers.json'] },
  },
})
