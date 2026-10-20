import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderTenFrame,renderCompare,renderNumberLine,mountTenFrame,mountCompare,mountNumberLine} from '../../public/mindforge/arcade/math/learning/manipulatives.mjs';

test('all ten-frame sizes 0..10 have exactly ten original cells and appropriate disabled controls',()=>{
 for(let n=0;n<=10;n++){
  const html=renderTenFrame(n,{mode:'count',language:'en'});
  assert.equal((html.match(/data-mf-cell="/g)||[]).length,10);
  assert.equal((html.match(/class="mf-cell filled/g)||[]).length,n);
  assert.equal((html.match(/tabindex="0"/g)||[]).length,n);
  assert.ok(html.includes('viewBox="0 0 520 220"'));
 }
});
test('build mode has exactly 10-n accessible empty cell targets',()=>{
 for(let n=0;n<=10;n++){
  const html=renderTenFrame(n,{mode:'build'});
  assert.equal((html.match(/tabindex="0"/g)||[]).length,10-n);
  assert.equal((html.match(/aria-disabled="true"/g)||[]).length,n);
 }
});
test('selected objects and VI localized labels render correctly',()=>{
 const count=renderTenFrame(3,{selected:[0,1],language:'vi',token:'star',palette:'violet'});
 assert.ok(count.includes('Chạm vào đồ vật để đếm'));
 assert.equal((count.match(/aria-pressed="true"/g)||[]).length,2);
 const build=renderTenFrame(5,{mode:'build',selected:[5,6],token:'flower'});
 assert.equal((build.match(/class="mf-cell filled/g)||[]).length,7);
 assert.ok(build.includes('aria-label="Đồ vật')===false);
});
test('compare renders two ten-frames and number-line has eleven 50px buttons',()=>{
 const html=renderCompare(4,7,{paired:[0,1]});
 assert.equal((html.match(/data-mf-cell="/g)||[]).length,20);
 assert.equal((html.match(/data-mf-group="/g)||[]).length,2);
 const line=renderNumberLine({value:7});
 assert.equal((line.match(/data-mf-number="/g)||[]).length,11);
 assert.equal((line.match(/aria-pressed="true"/g)||[]).length,1);
});
test('invalid counts are refused before rendering',()=>{
 for(const n of [-1,11,2.5,NaN,'5']){
  assert.throws(()=>renderTenFrame(n),RangeError);
  assert.throws(()=>renderCompare(n,5),RangeError);
 }
 assert.throws(()=>renderNumberLine({value:20}),RangeError);
});
test('mounted cells respond to click/keyboard through delegated events',()=>{
 const events={};
 const host={innerHTML:'',addEventListener:(k,fn)=>{events[k]=fn},removeEventListener:k=>{delete events[k]},contains:()=>true,querySelector:()=>({focus:()=>{}})};
 let state;
 const mounted=mountTenFrame(host,{count:8,mode:'build',onChange:v=>{state=v}});
 const node={dataset:{mfCell:'8'},closest:()=>node};
 events.click({target:node});
 assert.equal(state.total,9);
 assert.equal(mounted.getState().total,9);
 events.keydown({key:'Enter',preventDefault:()=>{},target:node});
 assert.equal(state.total,8);
 mounted.destroy();
 assert.equal(events.click,undefined);
});
