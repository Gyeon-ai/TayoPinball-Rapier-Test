import test from 'node:test';
import assert from 'node:assert/strict';
import { RapierPhysics } from '../src/physics-rapier.ts';
import { Box2dPhysics } from '../src/physics-box2d.ts';
import { RouletteRenderer } from '../src/rouletteRenderer.ts';
import { Marble } from '../src/marble.ts';
import { Minimap } from '../src/minimap.ts';
import { Camera } from '../src/camera.ts';
import { stages } from '../src/data/maps.ts';
import { Themes, initialZoom } from '../src/data/constants.ts';
import { Skills } from '../src/data/constants.ts';
import { RecordingContext } from './recording-context.mjs';

const close = (a,b,label='coordinate') => assert.ok(Math.abs(a-b)<0.0002, `${label}: ${a} != ${b}`);
const pointClose = (a,b) => { close(a.x,b.x,'x'); close(a.y,b.y,'y'); };
const transform = (p,t,angle) => ({x:t.x+p.x*Math.cos(angle)-p.y*Math.sin(angle), y:t.y+p.x*Math.sin(angle)+p.y*Math.cos(angle)});
const renderer = new RouletteRenderer();
const minimap = new Minimap();

test('angled neon bars collide at their drawn surface at 1/2/5x step batching',async()=>{
  const p=new RapierPhysics(); await p.init();
  try {
    for(const angle of [0,Math.PI/6,-Math.PI/3,Math.PI/2]) for(const speed of [1,2,5]) {
      p.clearMarbles();p.clear();p.world.gravity={x:0,y:0};
      const centre={x:10.25,y:16.3};
      p.createStage({title:'contact',goalY:30,zoomY:28,entities:[{type:'static',position:centre,shape:{type:'box',width:2,height:0.1,rotation:angle},props:{density:1,restitution:0,angularVelocity:0}}]});
      p.createMarble(0,centre.x+3*Math.sin(angle),centre.y-3*Math.cos(angle));p.start();
      p.marbles.get(0).setLinvel({x:-50*Math.sin(angle),y:50*Math.cos(angle)},true);
      for(let frame=0;frame<60/speed;frame++) for(let i=0;i<speed;i++) p.step(1/60);
      const pos=p.getMarblePosition(0);
      const localY=-(pos.x-centre.x)*Math.sin(angle)+(pos.y-centre.y)*Math.cos(angle);
      assert.ok(localY<=-0.33 && localY>=-0.4,`surface mismatch at angle=${angle}, speed=${speed}: ${localY}`);
    }
  } finally {p.dispose();}
});

for(const [mapIndex,stage] of stages.entries()) test(`map ${mapIndex}: full game marbles and skills reach goal`,async()=>{
  const p=new RapierPhysics();await p.init();
  const originalRandom=Math.random;
  let seed=20260928+mapIndex;
  Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  try {
    p.createStage(stage);
    const marbles=Array.from({length:30},(_,id)=>new Marble(p,id,30,`test-${id}`,0.1));
    p.start();marbles.forEach(m=>m.isActive=true);
    let finish=0,impacts=0;
    for(let step=1;step<=12000 && !finish;step++) {
      p.step(1/60);
      for(const m of marbles) {
        m.update(1000/60);
        assert.ok(Number.isFinite(m.x)&&Number.isFinite(m.y)&&Number.isFinite(m.angle));
        if(m.skill===Skills.Impact){p.impact(m.id);impacts++;}
        if(m.y>stage.goalY)finish=step;
      }
    }
    assert.ok(finish>0,'No goal within 200 seconds of simulation');
    console.log(`map ${mapIndex}: goal after ${finish} steps, ${impacts} impact events`);
  } finally {Math.random=originalRandom;p.dispose();}
});

for (const [mapIndex,stage] of stages.entries()) test(`map ${mapIndex}: actual canvas outlines match all Rapier collider shapes`,async()=>{
  const p=new RapierPhysics(); await p.init();
  try {
    p.createStage(stage);
    let checks=0;
    for(let sample=0;sample<4;sample++) {
      if(sample) for(let i=0;i<47;i++) p.step(1/60);
      const states=p.getEntities();
      for(let index=0;index<states.length;index++) {
        const state=states[index], collider=p.entities[index].collider;
        const ctx=new RecordingContext(); renderer.ctx=ctx;
        renderer.renderEntities([state]);
        const draw=ctx.records[0], t=collider.translation(), angle=collider.rotation();
        if(state.shape.type==='box') {
          const h=collider.halfExtents();
          const actual=[[-h.x,-h.y],[h.x,-h.y],[h.x,h.y],[-h.x,h.y]].map(([x,y])=>transform({x,y},t,angle));
          actual.forEach((v,i)=>pointClose(draw.points[i],v));
        } else if(state.shape.type==='circle') {
          pointClose(draw.center,t); close(draw.radius,collider.radius());
        } else {
          const vertices=collider.vertices();
          assert.equal(draw.points.length,vertices.length/2);
          draw.points.forEach((v,i)=>pointClose(v,transform({x:vertices[i*2],y:vertices[i*2+1]},t,angle)));
        }
        // The minimap must use the same geometry, including shape-local rotation.
        const small=new RecordingContext(); minimap.ctx=small;
        minimap.drawEntities([state],Themes.dark);
        assert.deepEqual(small.records[0],draw);
        checks++;
      }
    }
    console.log(`map ${mapIndex}: ${checks} entity snapshots matched (float tolerance 0.0002 world units)`);
  } finally {p.dispose();}
});

for(const Engine of [RapierPhysics,Box2dPhysics]) test(`${Engine.name}: rotating bar interpolation stays in phase with marbles`,async()=>{
  // box2d-wasm's older Node loader expects fs, not Node 24's file: fetch.
  const savedFetch=globalThis.fetch;
  if(Engine===Box2dPhysics) globalThis.fetch=undefined;
  const p=new Engine();
  try {
    await p.init();
    const stage={title:'phase',goalY:10,zoomY:9,entities:[{type:'kinematic',position:{x:0,y:4},shape:{type:'box',width:2,height:0.1,rotation:0.3},props:{density:1,restitution:0,angularVelocity:2}}]};
    p.createStage(stage);
    for(let i=0;i<120;i++) {
      const before=p.getEntities()[0].angle;
      p.step(1/60);
      const after=p.getEntities()[0].angle;
      for(const alpha of [0,0.25,0.5,0.75,1]) {
        const expected=before+Math.atan2(Math.sin(after-before),Math.cos(after-before))*alpha;
        const actual=p.getEntities(alpha)[0].angle;
        close(Math.sin(actual),Math.sin(expected),'interpolated angle sine');
        close(Math.cos(actual),Math.cos(expected),'interpolated angle cosine');
      }
    }
  } finally { globalThis.fetch=savedFetch; if(p.dispose) p.dispose(); else {p.clearMarbles();p.clear();} }
});

test('sprite centre, diameter and camera transforms match the marble collider',async()=>{
  const p=new RapierPhysics(); await p.init();
  try {
    const marble=new Marble(p,0,1,'test'); p.start(); marble.isActive=true;
    const before=marble.position;
    p.step(1/60); marble.update(1000/60);
    const after=marble.position, collider=p.marbles.get(0).collider(0);
    close(collider.radius(),marble.size/2);
    for(const zoom of [1,2,4]) for(const alpha of [0,0.5,1]) {
      const camera=new Camera(); camera.initializePosition({x:10,y:3},zoom);
      const ctx=new RecordingContext(); ctx.scale(initialZoom,initialZoom);
      camera.renderScene(ctx,()=>marble.render(ctx,initialZoom*zoom,false,false,{}, {x:10,y:3,w:1280,h:720,zoom:initialZoom*zoom},Themes.dark,alpha));
      const image=ctx.records.find(r=>r.kind==='image');
      const x=before.x+(after.x-before.x)*alpha, y=before.y+(after.y-before.y)*alpha;
      pointClose(image.center,{x:(x-10)*initialZoom*zoom+640,y:(y-3)*initialZoom*zoom+360});
      close(image.width,collider.radius()*2*initialZoom*zoom);
      close(image.height,image.width);
    }
  } finally {p.dispose();}
});
