#!/usr/bin/env node
// Deterministic editorial SVG + editable diagrams.net exports from one JSON source.
// Deliberately standalone: no server process, browser extension or design SaaS.
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const dir=path.join(root,'docs/agent-platform/editorial-diagrams');
const out=path.join(root,'dist/architecture/showcase');
fs.mkdirSync(out,{recursive:true});
const C={blue:['#4169DD','#F0F4FF'],teal:['#07968F','#EEF9F7'],violet:['#7958D9','#F5F1FC'],amber:['#C17E16','#FFF8E9'],slate:['#536480','#F4F6FA']};
const navy='#15233F',text='#1E2A44',muted='#63708A',stroke='#D8DFEB',background='#F6F8FC';
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
const xml=s=>esc(s);
function renderSvg(scene){
 const {width:W,height:H}=scene;
 const parts=[],p=s=>parts.push(s);
 p('<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="diagram-title diagram-desc" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'">');
 p('<title id="diagram-title">'+esc(scene.title)+'</title><desc id="diagram-desc">'+esc(scene.subtitle)+'</desc>');
 p('<rect width="'+W+'" height="'+H+'" fill="'+background+'"/>');
 p('<defs><filter id="soft-shadow" x="-20%" y="-30%" width="140%" height="165%"><feDropShadow dx="0" dy="7" stdDeviation="13" flood-color="#2B3757" flood-opacity=".08"/></filter>');
 p('<marker id="arrow" markerWidth="9" markerHeight="9" refX="7.4" refY="4.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 L9 4.5 L0 9 z" fill="#8794AA"/></marker></defs>');
 p('<rect x="0" y="0" width="'+W+'" height="8" fill="'+C.blue[0]+'"/>');
 p('<text x="56" y="69" font-family="Arial,sans-serif" font-size="19" letter-spacing="3" font-weight="700" fill="'+C.blue[0]+'">'+esc(scene.kicker)+'</text>');
 p('<text x="56" y="143" font-family="Arial,sans-serif" font-size="55" font-weight="700" fill="'+navy+'">'+esc(scene.title)+'</text>');
 p('<text x="56" y="190" font-family="Arial,sans-serif" font-size="24" fill="'+muted+'">'+esc(scene.subtitle)+'</text>');
 for(const b of scene.boxes.filter(x=>x.kind==='boundary')){
  const [color,tint]=C[b.accent];
  p('<rect x="'+b.x+'" y="'+b.y+'" width="'+b.w+'" height="'+b.h+'" rx="18" fill="'+tint+'" stroke="'+color+'" stroke-opacity=".36" stroke-width="2" stroke-dasharray="8 6"/>');
  p('<rect x="'+(b.x+19)+'" y="'+(b.y+23)+'" width="6" height="19" rx="3" fill="'+color+'"/>');
  p('<text x="'+(b.x+37)+'" y="'+(b.y+40)+'" font-family="Arial,sans-serif" font-size="18" font-weight="700" fill="'+text+'">'+esc(b.title)+'</text>');
  p('<text x="'+(b.x+22)+'" y="'+(b.y+67)+'" font-family="Arial,sans-serif" font-size="13" font-weight="700" letter-spacing="1.2" fill="'+muted+'">'+esc(b.desc)+'</text>');
 }
 for(const e of scene.edges){
  const color=C[e.accent][0],pts=e.points.map(([x,y])=>x+','+y).join(' ');
  p('<polyline points="'+pts+'" fill="none" stroke="'+color+'" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"'+(e.dashed?' stroke-dasharray="7 7"':'')+' marker-end="url(#arrow)"/>');
  if(e.label){
    const cx=(e.points[0][0]+e.points[1][0])/2,cy=(e.points[0][1]+e.points[1][1])/2-15,w=Math.max(65,e.label.length*9+18);
    p('<rect x="'+(cx-w/2)+'" y="'+(cy-18)+'" width="'+w+'" height="26" rx="10" fill="#FFFFFF" stroke="'+stroke+'"/>');
    p('<text x="'+cx+'" y="'+cy+'" font-family="Arial,sans-serif" font-size="14" font-weight="600" text-anchor="middle" fill="'+text+'">'+esc(e.label)+'</text>');
  }
 }
 for(const b of scene.boxes.filter(x=>x.kind!=='boundary')){
  const [color]=C[b.accent];
  if(b.kind==='note'){
    p('<text x="'+b.x+'" y="'+(b.y+25)+'" font-family="Arial,sans-serif" font-size="16" font-weight="700" fill="'+muted+'">'+esc(b.title)+'</text>');
    p('<text x="'+b.x+'" y="'+(b.y+55)+'" font-family="Arial,sans-serif" font-size="16" fill="'+muted+'">'+esc(b.desc)+'</text>');
    continue;
  }
  p('<rect x="'+b.x+'" y="'+b.y+'" width="'+b.w+'" height="'+b.h+'" rx="13" fill="#FFFFFF" stroke="'+stroke+'" stroke-width="1.5" filter="url(#soft-shadow)"/>');
  p('<rect x="'+(b.x+1)+'" y="'+(b.y+13)+'" width="5" height="'+(b.h-26)+'" rx="2.5" fill="'+color+'"/>');
  if(b.kind==='data'){
    p('<text x="'+(b.x+20)+'" y="'+(b.y+39)+'" font-family="Arial,sans-serif" font-size="19" font-weight="700" fill="'+text+'">'+esc(b.title)+'</text>');
    p('<text x="'+(b.x+20)+'" y="'+(b.y+69)+'" font-family="Arial,sans-serif" font-size="16" fill="'+muted+'">'+esc(b.desc)+'</text>');
  }else{
    const fontSize=b.title.length<24?19:17;
    p('<text x="'+(b.x+20)+'" y="'+(b.y+43)+'" font-family="Arial,sans-serif" font-size="'+fontSize+'" font-weight="700" fill="'+text+'">'+esc(b.title)+'</text>');
    p('<text x="'+(b.x+20)+'" y="'+(b.y+72)+'" font-family="Arial,sans-serif" font-size="15" fill="'+muted+'">'+esc(b.desc)+'</text>');
  }
 }
 p('<line x1="56" y1="'+(H-48)+'" x2="'+(W-56)+'" y2="'+(H-48)+'" stroke="'+stroke+'"/>');
 p('<text x="56" y="'+(H-24)+'" font-family="Arial,sans-serif" font-weight="700" letter-spacing="1" font-size="15" fill="'+muted+'">'+esc(scene.footer)+'</text>');
 p('</svg>');
 return parts.join('\n')+'\n';
}
function drawio(scene){
  const {width:W,height:H}=scene;
  const all=new Map(scene.boxes.map(b=>[b.id,b]));
  const root=['<?xml version="1.0" encoding="UTF-8"?>','<mxfile host="app.diagrams.net" version="24.7.17" type="device" agent="architecture-reference">','<diagram id="'+scene.slug+'" name="'+esc(scene.title)+'">','<mxGraphModel dx="1600" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="'+W+'" pageHeight="'+H+'" math="0" shadow="0"><root>','<mxCell id="0"/><mxCell id="1" parent="0"/>'];
  const renderCell=b=>{
    const [color,tint]=C[b.accent];
    const parent=b.parent??'1',offset=all.get(parent),x=b.x-(offset?.x??0),y=b.y-(offset?.y??0);
    let style;
    if(b.kind==='boundary')style='rounded=1;whiteSpace=wrap;html=1;fillColor='+tint+';strokeColor='+color+';dashed=1;dashPattern=8 5;strokeWidth=2;verticalAlign=top;align=left;spacingTop=20;spacingLeft=20;fontSize=17;fontStyle=1;fontColor='+navy+';container=1;collapsible=0;';
    else if(b.kind==='note')style='rounded=0;whiteSpace=wrap;html=1;fillColor=none;strokeColor=none;fontSize=15;fontColor='+muted+';align=left;';
    else style='rounded=1;arcSize=14;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor='+stroke+';strokeWidth=1.5;shadow=1;verticalAlign=middle;align=left;spacingLeft=16;fontSize=16;fontStyle=1;fontColor='+navy+';';
    const rich=esc(b.title)+(b.desc?'<br><font color="'+muted+'" style="font-size:12px">'+esc(b.desc)+'</font>':'');
    root.push('<mxCell id="'+esc(b.id)+'" value="'+xml(rich)+'" style="'+xml(style)+'" vertex="1" parent="'+esc(parent)+'"><mxGeometry x="'+x+'" y="'+y+'" width="'+b.w+'" height="'+b.h+'" as="geometry"/></mxCell>');
  };
  // Diagram.net requires a real mxCell parent for nested group elements.
  const ordered=[...scene.boxes.filter(b=>b.kind==='boundary'),...scene.boxes.filter(b=>b.kind!=='boundary')];
  ordered.forEach(renderCell);
  for(const e of scene.edges){
    const [color]=C[e.accent];
    const style='edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor='+color+';strokeWidth=3;endArrow=block;endFill=1;'+(e.dashed?'dashed=1;dashPattern=6 6;':'')+'fontColor='+text+';fontSize=13;labelBackgroundColor=#FFFFFF;';
    const start=e.points[0],end=e.points.at(-1);
    root.push('<mxCell id="'+esc(e.id)+'" value="'+esc(e.label)+'" style="'+xml(style)+'" edge="1" parent="1"><mxGeometry relative="1" as="geometry"><mxPoint x="'+start[0]+'" y="'+start[1]+'" as="sourcePoint"/><mxPoint x="'+end[0]+'" y="'+end[1]+'" as="targetPoint"/></mxGeometry></mxCell>');
  }
  root.push('</root></mxGraphModel></diagram></mxfile>');
  return root.join('\n')+'\n';
}
for(const slug of ['executive','containers']){
  const scene=JSON.parse(fs.readFileSync(path.join(dir,slug+'.json'),'utf8'));
  if(scene.slug!==slug||!scene.boxes?.length||!scene.edges?.length)throw Error('Invalid diagram JSON '+slug);
  const ids=new Set(scene.boxes.map(b=>b.id));
  if(ids.size!==scene.boxes.length)throw Error('Duplicate component ID '+slug);
  for(const b of scene.boxes)if(b.parent&&!ids.has(b.parent))throw Error('Missing parent: '+b.parent);
  for(const e of scene.edges)if(e.points.length<2)throw Error('Incomplete edge: '+e.id);
  const svg=renderSvg(scene),editable=drawio(scene);
  const base='editorial-'+slug;
  fs.writeFileSync(path.join(out,base+'.svg'),svg,'utf8');
  fs.writeFileSync(path.join(out,base+'.drawio'),editable,'utf8');
  console.log('Generated '+base+' (SVG + editable diagrams.net file)');
}
