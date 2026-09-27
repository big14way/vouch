import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto('file://' + new URL('./bg.html', import.meta.url).pathname);
await p.screenshot({ path: new URL('../img/vouch-bg.jpg', import.meta.url).pathname, type: 'jpeg', quality: 92 });
await b.close();
