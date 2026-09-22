const TOKEN = process.env.NEXT_PUBLIC_APP_TOKEN!

export const api = {
  get: (url: string) =>
    fetch(url, { headers: { 'x-app-token': TOKEN } }).then(r => r.json()),
  post: (url: string, body: any) =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-token': TOKEN },
      body: JSON.stringify(body),
    }).then(r => r.json()),
  patch: (url: string, body: any) =>
    fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-app-token': TOKEN },
      body: JSON.stringify(body),
    }).then(r => r.json()),
  del: (url: string) =>
    fetch(url, { method: 'DELETE', headers: { 'x-app-token': TOKEN } }).then(r => r.json()),
}