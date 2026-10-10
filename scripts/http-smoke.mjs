import assert from 'node:assert/strict';
const baseUrl=process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3005';
const includeApi=process.env.SMOKE_API==='1';
// The server is started in the background just before this runs: wait until it answers.
for(let attempt=0;;attempt+=1) {
  try { if((await fetch(`${baseUrl}/`)).ok) break; } catch {}
  if(attempt>=60) throw new Error(`HTTP smoke: ${baseUrl} did not answer within 60s`);
  await new Promise(resolve=>setTimeout(resolve,1000));
}
// A session or artist the events do not have is a 404, but only when the events could be read: an
// empty database (the Worker smoke) has no TRM-01, and an unreadable one leaves it to the stage.
const eventsResponse=await fetch(`${baseUrl}/api/events`);
const recorded=eventsResponse.ok ? (await eventsResponse.json()).some(event=>event.id==='TRM-01') : null;
const detailStatus=recorded===false ? 404 : 200;
const details=new Set(['/events/TRM-01','/events/TRM-01/request','/artists/stann-lumo']);
const routes=['/','/events','/artists','/transmit','/signal','/about',...details];
for(const route of routes) {
  const response=await fetch(`${baseUrl}${route}`);
  const html=await response.text();
  assert.equal(response.status,details.has(route) ? detailStatus : 200,route);
  assert.equal((html.match(/<main(?:\s|>)/g)??[]).length,1,`${route}: main landmark`);
  assert.ok(html.includes('href="#main"') && html.includes('id="main"'),`${route}: skip navigation`);
  assert.ok(html.includes('<title>'),`${route}: title`);
  assert.ok(!/<canvas(?:\s|>)/.test(html),`${route}: no inherited WebGL scene`);
}
for(const [route,target] of [['/home','/'],['/gate?event=TRM-01','/events/TRM-01'],['/gate/request?eventId=TRM-01&code=never-forward','/events/TRM-01/request'],['/lineup?event=TRM-01&artist=01-A','/artists/stann-lumo'],['/artists/appearance%3ATRM-01%3A01-A','/artists/stann-lumo'],['/artists/appearance%3ATRM-02%3A02-A','/artists/stann-lumo'],['/status','/events'],['/archive','/events'],['/events?selected=TRM-01','/events/TRM-01'],['/link','/about']]) {
  const response=await fetch(`${baseUrl}${route}`,{redirect:'manual'});
  assert.ok([307,308].includes(response.status),`${route}: redirect`);
  assert.equal(response.headers.get('location'),target,`${route}: selected record preserved, unrelated query stripped`);
}
assert.equal((await fetch(`${baseUrl}/not-a-terminal-page`)).status,404);
if(eventsResponse.ok) assert.equal((await fetch(`${baseUrl}/events/NO-SUCH-SESSION`)).status,404,'unknown session');
const robots=await fetch(`${baseUrl}/robots.txt`);
assert.equal(robots.status,200,'robots.txt');assert.match(await robots.text(),/User-Agent: \*/i,'robots.txt rules');
const sitemap=await fetch(`${baseUrl}/sitemap.xml`);
assert.equal(sitemap.status,200,'sitemap.xml');assert.match(await sitemap.text(),/<urlset[^>]*>[\s\S]*<loc>https:\/\/terminal\.stann\.kr\/events<\/loc>/,'sitemap.xml views');
if(includeApi) {
  for(const route of ['/api/events','/api/transmit?page=1']) {
    const response=await fetch(`${baseUrl}${route}`);
    assert.equal(response.status,200,route);assert.equal(response.headers.get('cache-control'),'no-store',`${route}: cache`);
    const body=await response.json();assert.ok(route.includes('events') ? Array.isArray(body) : Array.isArray(body.logs));
  }
}
console.log(`HTTP smoke PASS: ${routes.length} pages (details ${detailStatus}), 10 compatibility redirects, 404, robots, sitemap${includeApi?', 2 public APIs':''}; ${baseUrl}`);
