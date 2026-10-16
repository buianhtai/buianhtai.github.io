"""Build a curated, revision-pinned map from a local upstream checkout; no upstream code is executed."""
import json, re, subprocess, sys
from pathlib import Path
root=Path(sys.argv[1]).resolve()
revision=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
repo='https://github.com/deepseek-ai/deepseek-harness'
def source(path,line=1):
 assert (root/path).is_file(), path
 return {'path':path,'line':line,'url':f'{repo}/blob/{revision}/{path}#L{line}'}
groups={
 'boot':('Composition','Profiles and patches assemble the plugin tree.', ['boot/app-boot','boot/cmdline','boot/plugin-manager','boot/hmr']),
 'api':('Remote API','Session activation and the typed remote gateway.', ['api/gateway','api/session-controller','api/remotes']),
 'core':('Agent runtime','Agent contracts, the default driver, tools and session log.', ['core/agent','core/agent-loop','core/session','core/system-prompt','core/tools','core/scope']),
 'llm':('Model providers','A model service seam with replaceable adapters and retry policy.', ['llm/llm','llm/llm-deepseek-api-key','llm/llm-pi-ai','llm/llm-retry']),
 'session':('Durable state','Persistence and projections around the session event log.', ['session/session-persistence','session/session-persistence-jsonl','session/session-projection','session/session-checkpoint-policy']),
 'capabilities':('Capability plugins','External tools, execution policy, filesystem and shell capabilities.', ['mcp/mcp-client','guard/timeout-policy','fs/fs','shell/bash-local','sandbox/sandbox']),
}
# Explicit selections make the pilot comprehensible; missing names fail generation.
nodes=[]; views=[]; edges=[]; bypackage={}
for gid,(label,description,paths) in groups.items():
 nodes.append({'id':gid,'view':'system','label':label,'summary':description,'kind':'Subsystem','child':gid,'sources':[source('docs/architecture.md')]})
 for relative in paths:
  path=f'packages/{relative}/package.json'
  manifest=json.loads((root/path).read_text())
  nid=relative.replace('/','-'); bypackage[manifest['name']]=(nid,gid,manifest,path)
  refs=[source(path)]
  entry=f'packages/{relative}/src/index.ts'
  if (root/entry).is_file(): refs.append(source(entry))
  nodes.append({'id':nid,'view':gid,'label':relative.split('/')[-1],'summary':manifest.get('description','Package in the '+label+' subsystem.'),'kind':'Package','child':'loop' if relative=='core/agent-loop' else None,'sources':refs})
 views.append({'id':gid,'label':label,'parent':'system','description':description+' Edges show declared package dependencies within this view.'})
rollup={}
for name,(nid,gid,m,path) in bypackage.items():
 for dep in sorted(set(m.get('dependencies',{}))|set(m.get('peerDependencies',{}))):
  if dep not in bypackage: continue
  target,tg,_,_=bypackage[dep]
  if tg==gid: edges.append({'view':gid,'from':nid,'to':target,'label':'depends on','evidence':'Package manifest (runtime or peer dependency)','sources':[source(path)]})
  else: rollup.setdefault((gid,tg),[]).append(source(path))
for (a,b),refs in rollup.items(): edges.append({'view':'system','from':a,'to':b,'label':'depends on','evidence':'Aggregated declared dependencies between selected packages','sources':list({x['path']:x for x in refs}.values())})
files={
 'index.ts':('AgentLoop service','Creates and resumes agents, registers projections and manages ordered teardown.'),
 'agent.ts':('ReactLoopAgent','Drives turns and steps, derives requests from the log and settles model attempts.'),
 'inbox.ts':('Input inbox','Reconstructs pending input from durable inbox events and exposes claim operations.'),
 'assistant-stream.ts':('Assistant stream','Accumulates an attempt while emitting transient frames; settlement records the compact stream.'),
 'tool-calls.ts':('Tool scheduler','Runs exclusive barriers and a bounded parallel pool; finalizes results in model order.'),
 'runtime-context.ts':('Runtime context','Projects the system prompt and runtime context onto the durable session surface.'),
 'constants.ts':('Concurrency defaults','Defines the default maximum parallel tool-call count.'),
}
for filename,(label,summary) in files.items():
 path='packages/core/agent-loop/src/'+filename; content=(root/path).read_text()
 nodes.append({'id':'file-'+filename,'view':'loop','label':label,'summary':summary,'kind':'Source file','sources':[source(path)]})
 for match in re.finditer(r"from\s+['\"]\./([^'\"]+)['\"]",content):
  if match[1] in files: edges.append({'view':'loop','from':'file-'+filename,'to':'file-'+match[1],'label':'imports','evidence':'Lexical import, including type-only imports; not a proven runtime call','sources':[source(path,content[:match.start()].count('\n')+1)]})
views.insert(0,{'id':'system','label':'System overview','parent':None,'description':'A focused package dependency map. Arrows point from the dependent to its dependency; they do not indicate request order.'})
views.append({'id':'loop','label':'Agent-loop implementation','parent':'core','description':'Source-file imports inside the default driver. Use the turn walkthrough for a separately curated execution sequence.'})
steps=[
 ('file-inbox.ts','Claim input','The driver claims pending next-step input and a queued prompt. A turn can finish without spending a model step.', 'docs/agent-lifecycle.md',12),
 ('file-agent.ts','Assemble and admit','preStep assembles context and invokes agent/pre-step. Its decision may rewrite or reject the claimed messages.', 'packages/core/agent-loop/src/agent.ts',266),
 ('file-runtime-context.ts','Prepare the request','The driver prepares the model call, reconciles prompt/context and derives the request from the session log.', 'packages/core/agent-loop/src/agent.ts',411),
 ('file-assistant-stream.ts','Stream and settle','Transient assistant frames serve live listeners. Successful or failed attempts are settled into durable session events.', 'packages/core/agent-loop/src/agent.ts',443),
 ('file-tool-calls.ts','Schedule tools','Exclusive calls form barriers; parallel calls use a bounded pool. Results remain in model order.', 'packages/core/agent-loop/src/tool-calls.ts',60),
 ('file-agent.ts','Continue or stop','Record step/end. Pending tool work or input can lead to another step; otherwise finish the turn.', 'packages/core/agent-loop/src/agent.ts',358),
]
journey=[{'node':n,'title':t,'description':d,'source':source(p,l)} for n,t,d,p,l in steps]
result={'title':'DeepSeek Harness','repository':repo,'revision':revision,'scope':f'{len(bypackage)} selected packages; 7 agent-loop files. Curated subsystem boundaries, manifest-derived dependencies and lexical file imports. This is not a complete call graph or a live trace.','views':views,'nodes':nodes,'edges':edges,'journey':journey}
for e in edges:
 assert any(n['id']==e['from'] and n['view']==e['view'] for n in nodes)
 assert any(n['id']==e['to'] and n['view']==e['view'] for n in nodes)
out=Path('src/data/architecture/deepseek-harness.json');out.write_text(json.dumps(result,indent=2)+'\n')
print(f'{len(nodes)} nodes, {len(edges)} evidenced relationships, revision {revision}')
