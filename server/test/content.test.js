import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'barmaksan-content-test-'));
process.env.DATA_DIR = temp;
process.env.EDITOR_KEY = 'isolated-test-editor';
const { db } = await import('../src/db.js');
const cmd = await import('../src/commands.js');
const { createApp } = await import('../src/app.js');
const { createUser } = await import('../src/auth.js');
const { importProductContent } = await import('../seed/import-content.js');
const server = createApp().listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}/api`;
after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  db.close();
  fs.rmSync(temp, { recursive: true, force: true });
});

async function request(url, method = 'GET', body, authorized = true) {
  const response = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(authorized ? { 'X-Editor-Key': 'isolated-test-editor' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: await response.json() };
}
async function content(slug = 'cleanmax-4') { return (await request(`/folders/${slug}`)).data.content; }
const root = cmd.createFolder({ nameTr: 'Makineler', nameEn: 'Machines', slug: 'makineler' });
for (const [slug, name] of [['cleanmax-4','Cleanmax 4'], ['cleanmax-2','Cleanmax 2'], ['vibro-kepek-fircasi','Vibro Kepek Fırçası']]) cmd.createFolder({ parent: root.id, kind: 'machine', slug, nameTr: name, machine: { modelCode: name.toUpperCase() } });
const file = (mime, ext) => Number(db.prepare('INSERT INTO files(sha256,original_name,ext,mime,size_bytes,storage_key) VALUES(?,?,?,?,?,?)').run(crypto.randomUUID(), `fixture.${ext}`, ext, mime, 1, 'test/fixture').lastInsertRowid);
const pdf = file('application/pdf', 'pdf'), image = file('image/png','png');
const makeDoc = (folder, language, fileId = pdf, type = 'kullanim-kilavuzu') => cmd.createDocument({ folder, type, titleTr: `Kılavuz ${language}`, language, fileId }).publicId;
const trDoc = makeDoc('cleanmax-4','tr'), bilingual = makeDoc('cleanmax-4','tr-en'), generic = makeDoc('cleanmax-4','none');
const photo = makeDoc('cleanmax-4','none',image,'fotograf');
const foreignPhoto = makeDoc('cleanmax-2','none',image,'fotograf');
const profile = (title, description) => ({ title, description, features: ['Özellik'], applications: ['Un'], specifications: [{ title: 'Ölçü', columns: ['Model', 'mm'], rows: [['C4', '2305']] }], productUrl: 'https://www.ugurpromilling.com/tr/urun/cop-sasoru-cleanmax-4', changeNote: 'İlk içerik' });

test('schema upgrade is repeatable and retains document/version records', () => {
  const before = db.prepare('SELECT public_id,current_version_id,version_count FROM documents ORDER BY id').all();
  db.exec(fs.readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
  assert.deepEqual(db.prepare('SELECT public_id,current_version_id,version_count FROM documents ORDER BY id').all(), before);
  assert.equal(db.prepare('SELECT max(version) v FROM schema_version').get().v, 3);
});

test('writing requires authentication; arbitrary registered languages can be added', async () => {
  assert.equal((await request('/languages','POST',{code:'ru',label:'Rusça'},false)).status,401);
  assert.equal((await request('/languages','POST',{code:'ru',label:'Rusça',nativeName:'Русский'})).status,201);
  assert.equal((await request('/languages','POST',{code:'ar',label:'Arapça',nativeName:'العربية',direction:'rtl'})).status,201);
  assert.equal((await request('/languages','POST',{code:'ru',label:'Rusça'})).status,409);
  assert.equal((await request('/languages','POST',{code:'not-a-valid-locale',label:'Invalid'})).status,400);
  assert.equal((await request('/languages')).data.find((l) => l.code==='ar').direction,'rtl');
});

test('per-language stamps, maintenance content, revision conflicts and history round trip', async () => {
  const topic = { id:'rulman',translations:{tr:{title:'Bakım bilgisi',description:'Onaylı içerik',steps:['Birinci adım','İkinci adım'],warning:'Üretici uyarısı',videos:[{title:'Video',url:'https://example.com/video'}],documents:[trDoc],changeNote:'İlk kayıt'}} };
  const input = { ...(await content()), profiles:{tr:profile('Cleanmax 4','Sınıflandırıcı'),en:profile('Cleanmax 4','Separator'),ru:profile('Cleanmax 4','Сепаратор')}, gallery:[photo], maintenance:[{id:'sokum',titles:{tr:'Söküm',en:'Removal'},topics:[topic]}],note:'İlk yayın' };
  assert.equal((await request('/machines/cleanmax-4/content','PUT',input,false)).status,401);
  const first = await request('/machines/cleanmax-4/content','PUT',input);
  assert.equal(first.status,200);
  assert.equal(first.data.revision,1);
  assert.deepEqual((await content()).maintenance[0].topics[0].translations.tr.steps,topic.translations.tr.steps);
  const edited = structuredClone(first.data);
  edited.profiles.en.description='Revised English profile';
  const second=await request('/machines/cleanmax-4/content','PUT',edited);
  assert.equal(second.status,200);
  assert.equal(second.data.profiles.tr.updatedAt,first.data.profiles.tr.updatedAt);
  assert.equal(second.data.maintenance[0].topics[0].translations.tr.updatedAt,first.data.maintenance[0].topics[0].translations.tr.updatedAt);
  assert.equal((await request('/machines/cleanmax-4/content','PUT',input)).status,409);
  const history=(await request('/admin/machines/cleanmax-4/history')).data;
  assert.equal(history.length,2);
  assert.equal(history.at(-1).note,'İlk yayın');
});

test('same-type manuals keep separate languages and version histories; export respects selected locale', async () => {
  const ruDoc=makeDoc('cleanmax-4','ru');
  cmd.addVersion(ruDoc,{fileId:pdf,note:'Rusça v2'});
  assert.equal((await request(`/documents/${ruDoc}`)).data.language,'ru');
  assert.equal((await request(`/documents/${ruDoc}`)).data.versionCount,2);
  assert.equal((await request(`/documents/${trDoc}`)).data.versionCount,1);
  const exported=(await request('/catalog/machines/cleanmax-4?language=ru')).data;
  assert.deepEqual(Object.keys(exported.content.profiles),['ru']);
  assert.deepEqual(new Set(exported.documents.map((d)=>d.id)),new Set([ruDoc,generic,photo]));
  assert.equal((await request('/catalog/machines/cleanmax-4?language=fr')).status,404);
  assert.equal((await request('/documents/'+ruDoc,'PATCH',{language:'ar'})).status,200);
  assert.equal((await request('/documents/'+ruDoc)).data.language,'ar');
  assert.equal((await request('/documents/'+ruDoc,'PATCH',{language:'unknown'})).status,400);
  assert.equal((await request('/documents/'+ruDoc,'PATCH',{language:'en'})).status,200);
  assert.equal(db.prepare('SELECT count(*) n FROM document_languages WHERE document_id=(SELECT id FROM documents WHERE public_id=?)').get(ruDoc).n,0);
  const trExport=(await request('/catalog/machines/cleanmax-4?language=tr')).data;
  assert.ok(trExport.documents.some((d)=>d.id===bilingual));
});

test('publication author comes from the authenticated editor, not the old content stamp', async () => {
  createUser({email:'qa@local.test',name:'QA editor',password:'Isolated-test-password'});
  const login=(await request('/auth/login','POST',{email:'qa@local.test',password:'Isolated-test-password'})).data;
  const value=await content();value.profiles.en.description='Changed by authenticated editor';value.author='Previous source author';
  const response=await fetch(base+'/machines/cleanmax-4/content',{method:'PUT',headers:{'Content-Type':'application/json','X-Editor-Key':login.token},body:JSON.stringify(value)});
  assert.equal(response.status,200);
  const saved=await response.json();
  assert.equal(saved.profiles.en.author,'QA editor');
  assert.equal(saved.author,'QA editor');
  assert.equal(saved.profiles.tr.author,value.profiles.tr.author);
});

test('invalid URLs, mismatched tables and foreign attachments cannot partially publish', async () => {
  const base=await content();
  for (const mutate of [
    (v)=>{v.profiles.tr.productUrl='javascript:alert(1)';},
    (v)=>{v.profiles.tr.specifications[0].rows=[['C4']];},
    (v)=>{v.profiles.tr.specifications=[null];},
    (v)=>{v.gallery=[foreignPhoto];},
    (v)=>{v.gallery=[trDoc];},
    (v)=>{v.maintenance[0].topics[0].translations.tr.documents=[foreignPhoto];},
    (v)=>{v.maintenance[0].titles.multi='Yanlış dil';},
  ]) {
    const v=structuredClone(base);mutate(v);
    assert.equal((await request('/machines/cleanmax-4/content','PUT',v)).status,400);
    assert.equal((await content()).revision,base.revision);
  }
});

test('archiving attached documents removes stale links; an explicitly empty gallery stays empty', async () => {
  cmd.archiveDocument(photo,'Test');
  cmd.archiveDocument(trDoc,'Test');
  const v=await content();
  assert.deepEqual(v.gallery,[]);
  assert.deepEqual(v.maintenance[0].topics[0].translations.tr.documents,[]);
  assert.equal((await request('/machines/cleanmax-4/content','PUT',v)).status,200);
  assert.deepEqual((await content()).gallery,[]);
  assert.equal((await request('/machines/cleanmax-4/content','PUT',{...(await content()),gallery:null})).status,200);
  assert.equal((await content()).gallery,null);
});

test('model number search ignores unrelated capacities in technical text', async () => {
  const c=await content('cleanmax-2');c.profiles={tr:profile('Cleanmax 2','Cleanmax motoru 4 kW ve 42 mm')};
  assert.equal((await request('/machines/cleanmax-2/content','PUT',c)).status,200);
  const result=(await request('/search?q=cleanmax%204')).data;
  assert.ok(result.folders.some((f)=>f.slug==='cleanmax-4'));
  assert.ok(!result.folders.some((f)=>f.slug==='cleanmax-2'));
  const french=(await request('/languages','POST',{code:'fr',label:'Fransızca',nativeName:'Français'}));assert.equal(french.status,201);
  const frDoc=makeDoc('cleanmax-4','fr');
  assert.ok((await request('/search?q=fransizca')).data.documents.some((d)=>d.id===frDoc));
});

test('manufacturer import is repeatable and preserves edits; technical cells keep their columns', async () => {
  const before=await content();
  assert.equal(importProductContent().imported,1);
  assert.deepEqual(await content(),before);
  assert.equal(importProductContent().imported,0);
  const source=JSON.parse(fs.readFileSync(new URL('../../assets/site/product-content.json',import.meta.url),'utf8'));
  assert.equal(source['cleanmax-4'].tr.specifications[0].rows[1][1],'2120');
  for(const profiles of Object.values(source)) for(const p of Object.values(profiles)) for(const table of p.specifications) for(const row of table.rows) assert.equal(row.length,table.columns.length);
});

test('site language filters recent items before the limit, search results, media totals and pagination', async () => {
  const latestTr=makeDoc('cleanmax-4','tr');makeDoc('cleanmax-4','en');
  const recent=(await request('/recent?limit=1&language=tr')).data;
  assert.equal(recent.length,1);
  assert.equal(recent[0].id,latestTr);
  const searched=(await request('/search?q=kilavuz&language=fr')).data.documents;
  assert.ok(searched.length>0);
  assert.ok(searched.every((d)=>['fr','multi','none'].includes(d.language)));
  const trImage=makeDoc('cleanmax-4','tr',image,'fotograf');makeDoc('cleanmax-4','en',image,'fotograf');
  const page=(await request('/media?folder=cleanmax-4&language=tr&limit=1')).data;
  assert.equal(page.total,1);
  assert.deepEqual(page.items.map((d)=>d.id),[trImage]);
  assert.equal(page.next,null);
});

test('content-addressed preview URLs prevent reused file IDs from showing cached media', async () => {
  const id=file('image/webp','webp');
  fs.mkdirSync(path.join(temp,'storage','test'),{recursive:true});
  fs.writeFileSync(path.join(temp,'storage','test','cache.webp'),Buffer.from('first-image'));
  db.prepare('UPDATE files SET thumb_key=?,preview_key=? WHERE id=?').run('test/cache.webp','test/cache.webp',id);
  const doc=makeDoc('cleanmax-2','none',id,'fotograf');
  const first=(await request(`/documents/${doc}`)).data.current.file;
  assert.ok(first.thumb.endsWith(`?v=${first.cacheKey}`));
  let response=await fetch(base.replace('/api','')+first.preview);
  assert.equal(response.status,200);
  assert.match(response.headers.get('cache-control'),/immutable/);
  assert.equal(await response.text(),'first-image');
  response=await fetch(base.replace('/api','')+`/files/${id}/preview.webp`);
  assert.match(response.headers.get('cache-control'),/no-cache/);
  db.prepare('UPDATE files SET sha256=? WHERE id=?').run(crypto.randomUUID(),id);
  fs.writeFileSync(path.join(temp,'storage','test','cache.webp'),Buffer.from('replacement-document'));
  const next=(await request(`/documents/${doc}`)).data.current.file;
  assert.notEqual(next.preview,first.preview);
  response=await fetch(base.replace('/api','')+first.preview);
  assert.equal(response.status,404);
  assert.equal(response.headers.get('cache-control'),'no-store');
  response=await fetch(base.replace('/api','')+next.preview);
  assert.equal(await response.text(),'replacement-document');
});

test('active files and machines can be deleted directly, with authorization and shared files preserved', async () => {
  const machine=cmd.createFolder({parent:root.id,kind:'machine',slug:'delete-fixture',nameTr:'Silme testi'});
  const doc=makeDoc(machine.slug,'tr');
  const docId=db.prepare('SELECT id FROM documents WHERE public_id=?').get(doc).id;
  cmd.addVersion(doc,{fileId:pdf,note:'v2'});
  assert.equal((await request(`/folders/${machine.slug}/permanent`,'DELETE',{confirm:machine.slug},false)).status,401);
  assert.equal((await request(`/folders/${machine.slug}/permanent`,'DELETE',{})).status,400);
  assert.equal((await request(`/folders/not-found/permanent`,'DELETE',{confirm:'not-found'})).status,404);
  const current=(await content(machine.slug));
  assert.equal((await request(`/machines/${machine.slug}/content`,'PUT',{...current,profiles:{tr:profile('Silme testi','Test')}})).status,200);
  const result=await request(`/folders/${machine.slug}/permanent`,'DELETE',{confirm:machine.slug});
  assert.equal(result.status,200);
  assert.equal(result.data.documents,1);
  assert.equal((await request(`/folders/${machine.slug}`)).status,404);
  assert.equal(db.prepare('SELECT count(*) n FROM document_versions WHERE document_id=?').get(docId).n,0);
  assert.equal(db.prepare('SELECT count(*) n FROM machine_content WHERE folder_id=?').get(machine.id).n,0);
  assert.equal(db.prepare('SELECT count(*) n FROM machine_content_history WHERE folder_id=?').get(machine.id).n,0);
  assert.ok(db.prepare('SELECT 1 FROM files WHERE id=?').get(pdf));
  assert.equal((await request(`/documents/${generic}`)).status,200);
  const direct=makeDoc('cleanmax-2','none');
  assert.equal((await request(`/documents/${direct}/permanent`,'DELETE')).status,200);
  assert.equal((await request(`/documents/${direct}`)).status,404);
  const parent=cmd.createFolder({parent:root.id,kind:'collection',slug:'parent-fixture',nameTr:'Üst klasör'});
  cmd.createFolder({parent:parent.id,kind:'collection',slug:'child-fixture',nameTr:'Alt klasör'});
  assert.equal((await request(`/folders/${parent.slug}/permanent`,'DELETE',{confirm:parent.slug})).status,409);
  assert.ok(db.prepare('SELECT 1 FROM folders WHERE id=?').get(parent.id));
  const section=cmd.createFolder({kind:'section',slug:'protected-fixture',nameTr:'Ana bölüm'});
  assert.equal((await request(`/folders/${section.slug}/permanent`,'DELETE',{confirm:section.slug})).status,409);
});
