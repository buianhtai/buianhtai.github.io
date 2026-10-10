// Render a small, explicitly proposed Archify showcase alongside the native EventCatalog.
// Archify runs at pinned upstream commit supplied by GitHub Actions (no global skill install).
// EventCatalog remains the canonical resource/model/contract registry.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const vendor=path.join(root,'.vendor','archify','archify','bin','archify.mjs');
if(!existsSync(vendor))throw new Error('Pinned Archify renderer missing: '+vendor);
const catalog=path.join(root,'docs','agent-platform','eventcatalog-poc');
const scenarios=[
 {slug:'agent-platform-container-map',type:'architecture',refs:['PlatformAPI','AgentRegistry','RunService','RunDispatcher','AgentWorker','ModelGateway','ToolGateway']},
 {slug:'agent-run-sequence',type:'sequence',refs:['PlatformAPI','RunService','RunDispatcher','AgentWorker','ModelGateway','ToolGateway']},
 {slug:'approval-swimlane',type:'workflow',refs:['AgentWorker','ToolGateway','ApprovalService']}
];
for(const scenario of scenarios){
  const source=path.join(root,'docs','agent-platform','archify-pilot',scenario.slug+'.'+scenario.type+'.json');
  const diagram=JSON.parse(readFileSync(source,'utf8'));
  const expected='dist/architecture/showcase/'+scenario.slug+'.html';
  if(diagram.diagram_type!==scenario.type || diagram.meta?.output!==expected)
    throw new Error('Archify source type/output mismatch: '+source);
  for(const ref of scenario.refs){
    const resource=path.join(catalog,'services',ref,'index.mdx');
    if(!existsSync(resource))throw new Error('Archify pilot refers to missing EventCatalog service: '+ref);
  }
  if(scenario.slug==='agent-platform-container-map'){
    // Guard against repeating the original flat graph where Platform API was
    // accidentally rendered as frontend and no trust or deployment zones existed.
    const nodeTypes=new Map((diagram.components??[]).map(node=>[node.id,node.type]));
    const boundaries=(diagram.boundaries??[]);
    const required={
      frontend:['web'],backend:['api','registry','runs','approval'],
      execution:['queue','worker'],integration:['model','tools'],
      data:['configdb','events','artifacts'],external:['modelprovider','toolprovider']
    };
    if(nodeTypes.get('web')!=='frontend'||nodeTypes.get('api')!=='backend')
      throw new Error('Logical FE/BE separation missing: Chat UI must be frontend and Platform API backend');
    const covered=new Set();
    for(const [key,members] of Object.entries(required)){
      const b=boundaries.find(v=>v.label?.toLowerCase().includes(key));
      if(!b)throw new Error('Missing diagram boundary '+key);
      for(const id of members){
        if(!b.wraps?.includes(id))throw new Error('Boundary '+key+' does not wrap '+id);
        if(covered.has(id))throw new Error('Node '+id+' is ambiguously assigned to multiple logical boundaries');
        covered.add(id);
      }
    }
    if(!diagram.connections?.some(e=>e.from==='web'&&e.to==='api'))
      throw new Error('Missing UI-to-backend API communication link');
    console.log('Verified frontend/backend/execution/integration/data/external boundaries');
  }
  const out=path.join(root,expected);
  mkdirSync(path.dirname(out),{recursive:true});
  const args=(command,...extra)=>[vendor,command,scenario.type,source,...extra,'--quality','standard'];
  console.log('Validating Archify scenario '+scenario.slug);
  execFileSync(process.execPath,args('validate'),{cwd:root,stdio:'inherit',timeout:120000});
  console.log('Rendering Archify scenario '+scenario.slug);
  execFileSync(process.execPath,args('render',out),{cwd:root,stdio:'inherit',timeout:120000});
  execFileSync(process.execPath,[vendor,'check',out],{cwd:root,stdio:'inherit',timeout:120000});
  if(statSync(out).size<20000)throw new Error('Unexpectedly small Archify HTML: '+out);
  console.log('Rendered '+expected);
}
