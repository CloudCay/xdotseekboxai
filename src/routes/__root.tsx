import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'


import '../styles.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'SeekBoxAi',
      },
    ],
    links: [
      // Cache-bust so browsers pick up changes quickly.
      { rel: 'icon', type: 'image/png', href: '/favicon.png?v=2', sizes: '32x32' },
      { rel: 'apple-touch-icon', href: '/favicon.png?v=2' },
      // Many browsers still prefer .ico; cache-bust it too.
      { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico?v=2' },
      { rel: 'shortcut icon', href: '/favicon.ico?v=2' },
      // Some clients ignore querystrings for favicons; keep plain fallbacks.
      { rel: 'icon', type: 'image/png', href: '/favicon.png', sizes: '32x32' },
      { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-black text-white antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  )
}
