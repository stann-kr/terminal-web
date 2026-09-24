import assert from 'node:assert/strict';
const baseUrl=process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3005';
const includeApi=process.env.SMOKE_API==='1';
const routes=['/','/events','/artists','/transmit','/signal','/about','/events/TRM-01','/events/TRM-01/request','/artists/stann-lumo'];
for(const route of routes) {
  const response=await fetch(`${baseUrl}${route}`);
  const html=await response.text();
  assert.equal(response.status,200,route);
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
if(includeApi) {
  for(const route of ['/api/events','/api/transmit?page=1']) {
    const response=await fetch(`${baseUrl}${route}`);
    assert.equal(response.status,200,route);assert.equal(response.headers.get('cache-control'),'no-store',`${route}: cache`);
    const body=await response.json();assert.ok(route.includes('events') ? Array.isArray(body) : Array.isArray(body.logs));
  }
}
console.log(`HTTP smoke PASS: ${routes.length} pages, 10 compatibility redirects, 404${includeApi?', 2 public APIs':''}; ${baseUrl}`);
