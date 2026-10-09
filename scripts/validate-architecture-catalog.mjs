// Validate native EventCatalog resources and illustrative specifications before publication.
// Run AFTER npm install --prefix architecture-catalog; YAML parser is pinned in that project.
// No network, no connection to production systems and no inferred owner assignments.
import { createRequire } from 'node:module';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source=path.join(root,'docs','agent-platform','eventcatalog-poc');
const require=createRequire(path.join(root,'architecture-catalog','package.json'));
const YAML=require('yaml');
const errors=[]; const resources=new Map();
const kindOf=p=>p.includes('/entities/')?'entity':p.startsWith('adrs/')?'adr':p.startsWith('teams/')?'team':({queries:'query'}[p.split('/')[0]]??p.split('/')[0].replace(/s$/,''));
function walk(dir) {if (!existsSync(dir)) return [];return readdirSync(dir,{withFileTypes:true}).flatMap(ent=>ent.isDirectory()?walk(path.join(dir,ent.name)):[path.join(dir,ent.name)]);}
function key(k,id){return k+':'+id;}
function report(what,msg){errors.push(what+': '+msg);}
const textPaths=walk(source).filter(p=>p.endsWith('.mdx'));
for(const full of textPaths){
 const rel=path.relative(source,full).replaceAll('\\','/');
 if(!rel.endsWith('index.mdx') && !rel.startsWith('teams/'))continue;
 const content=readFileSync(full,'utf8');
 const front=content.match(/^---\s*\n([\s\S]*?)\n---/);
 if(!front){report(rel,'missing YAML frontmatter');continue;}
 let d;
 try{d=YAML.parse(front[1],{uniqueKeys:true})}catch(e){report(rel,'invalid YAML: '+e.message);continue;}
 const kind=kindOf(rel),id=d?.id;
 if(!id || !d?.name){report(rel,'missing id or name');continue;}
 if(kind!=='team' && !d.version)report(rel,'missing version');
 if(kind!=='team' && !['adr'].includes(kind)){
    if(d['x-implementation-status']!=='proposed')report(rel,'expected explicit x-implementation-status: proposed');
    if(!Array.isArray(d.owners)||!d.owners.includes('architecture-stewards'))report(rel,'expected provisional owner');
 }
 if(kind==='adr' && d.status!=='proposed')report(rel,'must remain proposed until decision review');
 if(resources.has(key(kind,id)))report(rel,'duplicate resource '+key(kind,id));
 resources.set(key(kind,id),{d,rel,content,kind});
}
function exists(kind,id,rel){if(!resources.has(key(kind,id)))report(rel,'unresolved '+kind+':'+id);}
function refList(res,field,kind){
 const arr=res.d[field];if(!arr)return;
 if(!Array.isArray(arr)){report(res.rel,field+' is not an array');return;}
 for(const r of arr){if(typeof r==='string')exists(kind,r,res.rel);else if(r&&typeof r.id==='string')exists(kind,r.id,res.rel);else report(res.rel,'invalid '+field+' reference');}
}
const messageKinds=['event','command','query'];
function messageExists(id,rel){if(!messageKinds.some(k=>resources.has(key(k,id))))report(rel,'unresolved message: '+id);}
for(const res of resources.values()){
 const {d,rel,kind}=res;
 if(kind!=='team'){
  for(const owner of d.owners??[])exists('team',owner,rel);
  if(kind==='domain'||kind==='system'){
   for(const [field,k] of [['services','service'],['systems','system'],['agents','agent'],['entities','entity']])refList(res,field,k);
  }
  if(kind==='service'){
   for(const fld of ['sends','receives'])for(const r of d[fld]??[])messageExists(r.id,rel);
   for(const spec of d.specifications??[]){
    if(!['openapi','asyncapi'].includes(spec.type))report(rel,'unsupported specification '+spec.type);
    const loc=path.join(source,path.dirname(rel),spec.path??'');
    if(!existsSync(loc)){report(rel,'missing spec '+spec.path);continue;}
    let s;try{s=JSON.parse(readFileSync(loc,'utf8'));}catch(e){report(rel,'invalid JSON specification '+e.message);continue;}
    if(spec.type==='openapi' && !String(s.openapi??'').startsWith('3.'))report(rel,'OpenAPI version invalid');
    if(spec.type==='asyncapi' && !String(s.asyncapi??'').startsWith('3.'))report(rel,'AsyncAPI version invalid');
    if(!s.info?.title||!s.info?.version)report(rel,'spec must declare title and version');
    const rpath=/^#\/(.+)$/;
    function verifyRefs(obj){if(Array.isArray(obj)){obj.forEach(verifyRefs);return;}if(obj&&typeof obj==='object'){
     for(const [k,v] of Object.entries(obj)){if(k==='$ref' && typeof v==='string'&&rpath.test(v)){
       let pointer=v.slice(2).split('/').map(t=>t.replaceAll('~1','/').replaceAll('~0','~')),target=s;
       for(const token of pointer)target=target?.[token];
       if(target===undefined)report(rel,'broken JSON $ref: '+v);
      }else verifyRefs(v);}}}
    verifyRefs(s);
    if(spec.type==='asyncapi'){
      for(const [id,ch] of Object.entries(s.channels??{})){
        const event=resources.get(key('event',id));
        if(!event){report(rel,'AsyncAPI channel lacks EventCatalog event: '+id);continue;}
        const payload=ch.messages?.[id]?.payload;
        if(!payload){report(rel,'AsyncAPI channel missing message payload: '+id);continue;}
        const fp=path.join(source,path.dirname(event.rel),event.d.schemaPath??'');
        if(!existsSync(fp)){report(rel,'event schema missing for '+id);continue;}
        const catalogSchema=JSON.parse(readFileSync(fp,'utf8'));
        for(const field of payload.required??[])if(!(catalogSchema.required??[]).includes(field))
          report(rel,id+' required field not required in EventCatalog message: '+field);
        for(const [field,decl] of Object.entries(payload.properties??{})){
          const existing=catalogSchema.properties?.[field];
          if(!existing){report(rel,id+' field missing from EventCatalog message: '+field);continue;}
          if(decl.type && existing.type && decl.type!==existing.type)report(rel,id+' field type drift: '+field);
          if(decl.const!==undefined && existing.const!==undefined && decl.const!==existing.const)report(rel,id+' constant drift: '+field);
        }
      }
    }
   }
  }
  if(kind==='entity'){
    for(const p of d.properties??[])if(p.references)exists('entity',p.references,rel);
  }
  if(kind==='flow'){
   const steps=d.steps??[],ids=new Set();
   for(const s of steps){if(!s.id)report(rel,'step without id');if(ids.has(s.id))report(rel,'duplicate flow step '+s.id);ids.add(s.id);}
   for(const s of steps){
    if(s.service)exists('service',s.service.id,rel);
    if(s.flow)exists('flow',s.flow.id,rel);
    if(s.message)messageExists(s.message.id,rel);
    const edges=[...(s.next_steps??[]),...(s.next_step?[s.next_step]:[])];
    for(const edge of edges)if(!ids.has(edge.id))report(rel,'step '+s.id+' points to missing '+edge.id);
   }
  }
  if(kind==='adr'){
    for(const r of d.appliesTo??[])exists(r.type,r.id,rel);
  }
  if(['event','command','query'].includes(kind)){
   if(!d.schemaPath)report(rel,'missing schemaPath');
   else {
    const loc=path.join(source,path.dirname(rel),d.schemaPath);
    if(!existsSync(loc))report(rel,'missing schema '+d.schemaPath);
    else{try{
      const schema=JSON.parse(readFileSync(loc,'utf8'));
      if(schema.type!=='object')report(rel,'message JSON schema must describe an object');
      for(const x of schema.required??[])if(!(x in (schema.properties??{})))report(rel,'required field absent from properties: '+x);
     }catch(e){report(rel,'invalid schema JSON '+e.message);}
    }
   }
  }
 }
}
for(const kind of ['team','adr','domain','system','service','agent','flow','entity','event','command','query']){
 console.log(kind+': '+[...resources.values()].filter(r=>r.kind===kind).length+' documented resource(s)');
}
if(errors.length){console.error('\nArchitecture validation found '+errors.length+' issue(s):\n'+errors.map(x=>' - '+x).join('\n'));process.exit(1);}
console.log('Architecture relationship, ownership, flow edge, JSON schema and API spec validation passed.');
