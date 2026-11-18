import { defineConfig } from 'vitepress'

const BASE = '/unawakened-poe-trade/'

export default defineConfig({
  title: 'Unawakened PoE Trade',
  description: 'Not quite awakened. Still checks prices. (Path of Exile price-checking app)',
  base: BASE,
  mpa: true,
  head: [
    ['link', { rel: 'shortcut icon', type: 'image/png', href: `${BASE}favicon.png` }]
  ],
  markdown: {
    theme: 'light-plus',
    attrs: {
      leftDelimiter: '{:',
      rightDelimiter: '}'
    }
  },
  themeConfig: {
    // logo: 'TODO', https://github.com/vuejs/vitepress/issues/1401
    appVersion: '3.30.8',
    github: {
      releasesUrl: 'https://github.com/SlowQuasar/unawakened-poe-trade/releases'
    },
    socialLinks: [
      {
        text: 'GitHub',
        color: '#181717',
        link: 'https://github.com/SlowQuasar/unawakened-poe-trade'
      }
    ],
    sidebar: [
      {
        items: [{
          text: 'Download',
          link: '/download'
        }, {
          text: 'Quick Start',
          link: '/quick-start'
        }]
      },
      {
        items: [{
          text: 'Chat commands',
          link: '/chat-commands'
        }, {
          text: 'OCR Guide',
          link: '/ocr-guide'
        }]
      },
      {
        items: [{
          text: 'Common issues',
          link: '/issues'
        }, {
          text: 'FAQ',
          link: '/faq'
        }]
      }
    ]
  }
})
