/**
 * Plain HTML fallback page returned by the server when rendering fails.
 */
export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>This page didn't load</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root { color-scheme: light; --bg: #f8fafc; --fg: #172033; --muted: #526078; --primary: #126fe5; --primary-fg: #fff; --surface: #fff; --border: #cbd5e1; }
      :root.dark { color-scheme: dark; --bg: #0c0d0f; --fg: #fafafa; --muted: #a1a1aa; --primary: #a3f52d; --primary-fg: #17220d; --surface: #181a1d; --border: #303236; }
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--fg); display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: var(--muted); margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: var(--primary); color: var(--primary-fg); }
      .secondary { background: var(--surface); color: var(--fg); border-color: var(--border); }
    </style>
  </head>
  <body>
    <script>try{if(localStorage.getItem('ballfindr-theme')!=='light')document.documentElement.className='dark'}catch(e){document.documentElement.className='dark'}</script>
    <div class="card">
      <h1>This page didn't load</h1>
      <p>Something went wrong on our end. You can try refreshing or head back home.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Try again</button>
        <a class="secondary" href="/">Go home</a>
      </div>
    </div>
  </body>
</html>`;
}
