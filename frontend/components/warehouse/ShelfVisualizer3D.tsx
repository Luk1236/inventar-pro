import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

const pad2 = (n: number) => String(n).padStart(2, '0');

interface Props {
  blocks: number;
  levels: number;
  spots: number;
  fillData: Record<string, number>; // key: "BB-EE-PP" → 0-100
  onSpotPress: (block: number, level: number, spot: number, code: string, pct: number) => void;
}

function buildHtml(blocks: number, levels: number, spots: number, fillData: Record<string, number>): string {
  const cfgJson = JSON.stringify({ blocks, levels, spots });
  const fdJson = JSON.stringify(fillData);

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Stellplatz-Visualisierer 3D</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\/script>
<style>
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=Barlow:wght@300;400;500&display=swap');
:root{--bg:#111a26;--panel:rgba(10,16,28,0.97);--blue:#2196f3;--blue-l:#64b5f6;--blue-d:#1a7fd4;--accent:#f0a500;--text:#e8edf5;--muted:#6a80a0}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:'Barlow',sans-serif;height:100vh;display:flex;flex-direction:column;overflow:hidden}
.wrap{display:flex;flex:1;overflow:hidden;padding:4px}
.cvs-wrap{flex:1;position:relative;overflow:hidden}
#c{display:block;width:100%;height:100%}
#lbl-layer{position:absolute;inset:0;pointer-events:none}
.shelf-label{position:absolute;transform:translate(-50%,-50%);font-family:'Barlow Condensed',sans-serif;font-weight:700;letter-spacing:2px;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,0.8),0 0 20px rgba(33,150,243,0.6);pointer-events:none;white-space:nowrap}
.block-label{font-size:15px;color:#64b5f6;text-transform:uppercase}
#vcube{position:absolute;top:8px;right:8px;width:120px;height:130px;cursor:pointer;user-select:none}
.cube-svg text{font-family:'Barlow Condensed',sans-serif;font-size:8px;font-weight:700}
#zoom-btns{position:absolute;right:8px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:6px}
.zoom-btn{width:32px;height:32px;background:rgba(10,16,28,0.85);border:1px solid rgba(33,150,243,0.35);border-radius:8px;color:#64b5f6;font-size:18px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s}
.zoom-btn:hover{background:rgba(33,150,243,0.25)}
#rot-bar{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:10px;background:rgba(10,16,28,0.85);border:1px solid rgba(33,150,243,0.3);border-radius:20px;padding:7px 16px}
.rot-icon{font-size:16px;color:var(--muted);cursor:pointer;user-select:none}
#rot-slider{-webkit-appearance:none;width:160px;height:4px;border-radius:2px;background:#1c2a3e;outline:none}
#rot-slider::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:var(--blue);cursor:pointer;box-shadow:0 0 6px rgba(33,150,243,0.8)}
.tip{position:fixed;background:rgba(5,10,20,0.97);border:1px solid var(--blue);border-radius:7px;padding:5px 12px 6px;font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;color:var(--blue);letter-spacing:1px;pointer-events:none;opacity:0;transition:opacity .12s;z-index:100;line-height:1.6}
.tip.on{opacity:1}
.tf{font-size:11px;font-weight:600;display:block}
</style>
</head>
<body>
<div class="wrap">
  <div class="cvs-wrap">
    <canvas id="c"></canvas>
    <div id="lbl-layer"></div>
    <div id="vcube">
      <svg id="vcube-svg" width="120" height="130" viewBox="0 0 120 130">
        <defs>
          <filter id="vcf"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="rgba(0,0,0,0.45)"/></filter>
          <linearGradient id="gTop" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#f0f4f8"/><stop offset="100%" stop-color="#c8d8e8"/>
          </linearGradient>
          <linearGradient id="gFront" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#dde8f4"/><stop offset="100%" stop-color="#b0c8de"/>
          </linearGradient>
          <linearGradient id="gRight" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#e8f0f8"/><stop offset="100%" stop-color="#c0d4e8"/>
          </linearGradient>
        </defs>
        <g filter="url(#vcf)">
          <polygon id="vc-top"   points="60,10 95,28 60,46 25,28" fill="url(#gTop)"   stroke="#9ab8cc" stroke-width="1" style="cursor:pointer"/>
          <polygon id="vc-front" points="25,28 60,46 60,82 25,64" fill="url(#gFront)" stroke="#9ab8cc" stroke-width="1" style="cursor:pointer"/>
          <polygon id="vc-right" points="60,46 95,28 95,64 60,82" fill="url(#gRight)" stroke="#9ab8cc" stroke-width="1" style="cursor:pointer"/>
          <line x1="60" y1="10" x2="95" y2="28" stroke="white" stroke-width="1.2" opacity="0.6" pointer-events="none"/>
          <line x1="60" y1="10" x2="25" y2="28" stroke="white" stroke-width="1.2" opacity="0.6" pointer-events="none"/>
          <line x1="60" y1="46" x2="60" y2="82" stroke="rgba(255,255,255,0.4)" stroke-width="0.8" pointer-events="none"/>
        </g>
        <circle id="vc-iso" cx="60" cy="10" r="8" fill="transparent" stroke="none" style="cursor:pointer"/>
        <text x="60" y="30" text-anchor="middle" dominant-baseline="middle" font-family="Barlow Condensed,sans-serif" font-size="10" font-weight="700" fill="#1a3a5a" pointer-events="none">Top</text>
        <text x="38" y="57" text-anchor="middle" dominant-baseline="middle" font-family="Barlow Condensed,sans-serif" font-size="9.5" font-weight="700" fill="#1a3a5a" pointer-events="none">Front</text>
        <text x="80" y="57" text-anchor="middle" dominant-baseline="middle" font-family="Barlow Condensed,sans-serif" font-size="9.5" font-weight="700" fill="#1a3a5a" pointer-events="none">Right</text>
        <g id="vc-arc-l" style="cursor:pointer">
          <path d="M 14,70 A 48,20 0 0,0 52,90" fill="none" stroke="rgba(100,181,246,0.8)" stroke-width="3" stroke-linecap="round"/>
          <polygon points="52,85 52,95 59,89" fill="rgba(100,181,246,0.9)"/>
        </g>
        <g id="vc-arc-r" style="cursor:pointer">
          <path d="M 106,70 A 48,20 0 0,1 68,90" fill="none" stroke="rgba(100,181,246,0.8)" stroke-width="3" stroke-linecap="round"/>
          <polygon points="68,85 68,95 61,89" fill="rgba(100,181,246,0.9)"/>
        </g>
        <path d="M 10,28 A 20,46 0 0,0 10,68" fill="none" stroke="rgba(160,200,220,0.4)" stroke-width="1.5" stroke-dasharray="3 2" pointer-events="none"/>
        <path d="M 110,28 A 20,46 0 0,1 110,68" fill="none" stroke="rgba(160,200,220,0.4)" stroke-width="1.5" stroke-dasharray="3 2" pointer-events="none"/>
        <g id="vc-rot90l" style="cursor:pointer">
          <circle cx="22" cy="113" r="12" fill="rgba(15,25,45,0.8)" stroke="rgba(100,181,246,0.45)" stroke-width="1.2"/>
          <text x="22" y="114" text-anchor="middle" dominant-baseline="middle" font-size="15" fill="#90caf9" font-family="sans-serif" pointer-events="none">↺</text>
        </g>
        <g id="vc-home" style="cursor:pointer">
          <circle cx="60" cy="113" r="12" fill="rgba(15,25,45,0.8)" stroke="rgba(100,181,246,0.45)" stroke-width="1.2"/>
          <circle cx="60" cy="113" r="5" fill="none" stroke="rgba(100,181,246,0.8)" stroke-width="1.5" pointer-events="none"/>
          <circle cx="60" cy="113" r="1.8" fill="rgba(100,181,246,1)" pointer-events="none"/>
        </g>
        <g id="vc-rot90r" style="cursor:pointer">
          <circle cx="98" cy="113" r="12" fill="rgba(15,25,45,0.8)" stroke="rgba(100,181,246,0.45)" stroke-width="1.2"/>
          <text x="98" y="114" text-anchor="middle" dominant-baseline="middle" font-size="15" fill="#90caf9" font-family="sans-serif" pointer-events="none">↻</text>
        </g>
      </svg>
    </div>
    <div id="zoom-btns">
      <button class="zoom-btn" id="zi">+</button>
      <button class="zoom-btn" id="zo">−</button>
    </div>
    <div id="rot-bar">
      <span class="rot-icon" id="rot-l">↺</span>
      <input type="range" id="rot-slider" min="0" max="360" value="55">
      <span class="rot-icon" id="rot-r">↻</span>
    </div>
  </div>
</div>
<div class="tip" id="tip"><span id="tc2"></span><span class="tf" id="tf"></span></div>

<script>
// Injected config
var __CFG__ = ${cfgJson};
var __FD__ = ${fdJson};

const pad = n => String(n).padStart(2,'0');
let S = { blocks:__CFG__.blocks, levels:__CFG__.levels, spots:__CFG__.spots, sel:null };

function getFill(b,e,p){
  const k=pad(b)+'-'+pad(e)+'-'+pad(p);
  return k in __FD__ ? __FD__[k] : 0;
}

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x141e2e);
scene.fog = new THREE.Fog(0x141e2e, 30, 60);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
let camTheta = Math.PI * 0.3;
let camPhi   = Math.PI * 0.32;
let camRadius = 10;
let camTarget = new THREE.Vector3(0, 0, 0);

function updateCamera(){
  camera.position.set(
    camTarget.x + camRadius * Math.sin(camPhi) * Math.sin(camTheta),
    camTarget.y + camRadius * Math.cos(camPhi),
    camTarget.z + camRadius * Math.sin(camPhi) * Math.cos(camTheta)
  );
  camera.lookAt(camTarget);
}

const ambient = new THREE.AmbientLight(0xffffff, 0.45);
scene.add(ambient);
const sunLight = new THREE.DirectionalLight(0xfff8f0, 1.1);
sunLight.position.set(8, 14, 6);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048,2048);
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 50;
sunLight.shadow.camera.left = -15;
sunLight.shadow.camera.right = 15;
sunLight.shadow.camera.top = 15;
sunLight.shadow.camera.bottom = -5;
sunLight.shadow.bias = -0.001;
scene.add(sunLight);
const fillLight = new THREE.DirectionalLight(0x4488cc, 0.35);
fillLight.position.set(-6, 4, -3);
scene.add(fillLight);
const rimLight = new THREE.DirectionalLight(0x88bbff, 0.2);
rimLight.position.set(0, 2, -8);
scene.add(rimLight);

function makeWoodTex(){
  const cv = document.createElement('canvas');
  cv.width=512; cv.height=128;
  const ctx = cv.getContext('2d');
  const grad = ctx.createLinearGradient(0,0,0,128);
  grad.addColorStop(0,'#9a7030'); grad.addColorStop(0.5,'#7a5520'); grad.addColorStop(1,'#8a6228');
  ctx.fillStyle=grad; ctx.fillRect(0,0,512,128);
  for(let x=0;x<512;x+=42+Math.random()*8){
    ctx.strokeStyle='rgba(40,20,5,0.5)'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,128); ctx.stroke();
  }
  for(let i=0;i<80;i++){
    const y=Math.random()*128;
    ctx.strokeStyle='rgba('+(Math.random()>0.5?'30,15,5':'160,110,40')+','+(Math.random()*0.25+0.1)+')';
    ctx.lineWidth=Math.random()*1.5+0.3;
    ctx.beginPath(); ctx.moveTo(0,y);
    let cx=0;
    while(cx<512){cx+=Math.random()*30+10; ctx.lineTo(cx,y+(Math.random()-0.5)*3);}
    ctx.stroke();
  }
  const t=new THREE.CanvasTexture(cv);
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(2,1);
  return t;
}

function makeBeamTex(){
  const cv=document.createElement('canvas');
  cv.width=256; cv.height=256;
  const ctx=cv.getContext('2d');
  ctx.fillStyle='#1a5aaa'; ctx.fillRect(0,0,256,256);
  for(let i=0;i<60;i++){
    const y=Math.random()*256;
    ctx.strokeStyle='rgba('+(Math.random()>0.5?'100,160,220':'10,30,70')+','+(Math.random()*0.18+0.05)+')';
    ctx.lineWidth=Math.random()*2+0.5;
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(256,y+(Math.random()-0.5)*3); ctx.stroke();
  }
  ctx.strokeStyle='rgba(30,100,180,0.6)'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(0,4); ctx.lineTo(256,4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,252); ctx.lineTo(256,252); ctx.stroke();
  const t=new THREE.CanvasTexture(cv);
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(3,1);
  return t;
}

function makeBoxTex(hexColor){
  const cv=document.createElement('canvas');
  cv.width=256;cv.height=256;
  const ctx=cv.getContext('2d');
  const r=parseInt(hexColor.slice(1,3),16),g=parseInt(hexColor.slice(3,5),16),b=parseInt(hexColor.slice(5,7),16);
  ctx.fillStyle=hexColor; ctx.fillRect(0,0,256,256);
  for(let y=0;y<256;y+=7){
    ctx.strokeStyle='rgba(0,0,0,0.12)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(256,y); ctx.stroke();
  }
  ctx.fillStyle='rgba('+Math.floor(r*0.7)+','+Math.floor(g*0.7)+','+Math.floor(b*0.7)+',0.4)';
  ctx.fillRect(100,0,56,256);
  const eg=ctx.createLinearGradient(0,0,30,0);
  eg.addColorStop(0,'rgba(0,0,0,0.35)'); eg.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=eg; ctx.fillRect(0,0,30,256);
  const eg2=ctx.createLinearGradient(226,0,256,0);
  eg2.addColorStop(0,'rgba(0,0,0,0)'); eg2.addColorStop(1,'rgba(0,0,0,0.25)');
  ctx.fillStyle=eg2; ctx.fillRect(226,0,30,256);
  const t=new THREE.CanvasTexture(cv);
  return t;
}

function makeFloorTex(){
  const cv=document.createElement('canvas'); cv.width=512;cv.height=512;
  const ctx=cv.getContext('2d');
  ctx.fillStyle='#d0d8e4'; ctx.fillRect(0,0,512,512);
  ctx.strokeStyle='rgba(100,130,170,0.35)'; ctx.lineWidth=1;
  for(let x=0;x<=512;x+=64){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,512);ctx.stroke();}
  for(let y=0;y<=512;y+=64){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(512,y);ctx.stroke();}
  const t=new THREE.CanvasTexture(cv);
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(6,6);
  return t;
}

const woodTex  = makeWoodTex();
const beamTex  = makeBeamTex();
const floorTex = makeFloorTex();

const matBeam = new THREE.MeshStandardMaterial({color:0x1565c0, map:beamTex, metalness:0.65, roughness:0.3});
const matPost = new THREE.MeshStandardMaterial({color:0x1976d2, metalness:0.7, roughness:0.28});
const matRivet = new THREE.MeshStandardMaterial({color:0x90caf9, metalness:0.9, roughness:0.15});
const matWood  = new THREE.MeshStandardMaterial({map:woodTex, roughness:0.82, metalness:0.02});
const matPanel = new THREE.MeshStandardMaterial({color:0xaaccee, transparent:true, opacity:0.18, roughness:0.05, metalness:0.1, side:THREE.DoubleSide});
const matBrace = new THREE.MeshStandardMaterial({color:0x607d8b, metalness:0.5, roughness:0.5});
const matFloor = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.95, metalness:0});

const boxTexCache={};
function getBoxMat(pct){
  let hex;
  if(pct<=60) hex='#3d8b40';
  else if(pct<=80) hex='#f9a825';
  else hex='#d32f2f';
  if(!boxTexCache[hex]) boxTexCache[hex]=new THREE.MeshStandardMaterial({
    color:new THREE.Color(hex), map:makeBoxTex(hex), roughness:0.65, metalness:0.05
  });
  return boxTexCache[hex];
}

let shelfGroup = null;
let hitMeshes  = [];
let labelData  = [];

function addBox(parent, x,y,z, w,h,d, mat, castShadow=true, recvShadow=true){
  const g = new THREE.BoxGeometry(w,h,d);
  const m = new THREE.Mesh(g, mat);
  m.position.set(x+w/2, y+h/2, z+d/2);
  m.castShadow=castShadow; m.receiveShadow=recvShadow;
  parent.add(m);
  return m;
}

function addCylinder(parent, x,y,z, r,h, mat){
  const g = new THREE.CylinderGeometry(r,r,h,8);
  const m = new THREE.Mesh(g, mat);
  m.position.set(x,y,z);
  parent.add(m);
  return m;
}

function addRivets(parent, x0,y,z0, length, axis, count){
  for(let i=0;i<count;i++){
    const t=(i+0.5)/count;
    const rx=axis==='x'? x0+length*t : x0;
    const rz=axis==='z'? z0+length*t : z0;
    addCylinder(parent, rx, y, rz, 0.025, 0.03, matRivet);
  }
}

function addXBrace(parent, x, z0, z1, y0, y1){
  const len = Math.sqrt((z1-z0)**2+(y1-y0)**2);
  const m1 = new THREE.Mesh(new THREE.BoxGeometry(0.025, len, 0.025), matBrace);
  const midY=(y0+y1)/2, midZ=(z0+z1)/2;
  const ang1=Math.atan2(z1-z0, y1-y0);
  m1.position.set(x, midY, midZ);
  m1.rotation.x=ang1;
  parent.add(m1);
  const m2 = new THREE.Mesh(new THREE.BoxGeometry(0.025, len, 0.025), matBrace);
  m2.position.set(x, midY, midZ);
  m2.rotation.x=-ang1;
  parent.add(m2);
}

const SPOT_W = 1.05;
const SHELF_D = 0.90;
const POST_S  = 0.07;
const BEAM_H  = 0.11;
const BEAM_D  = 0.07;
const CELL_H  = 1.05;
const LEVEL_H = CELL_H + BEAM_H;
const BLOCK_GAP = 0.45;

function buildScene(){
  if(shelfGroup){ scene.remove(shelfGroup); shelfGroup.traverse(o=>{if(o.geometry)o.geometry.dispose();}); }
  hitMeshes=[];
  labelData=[];
  document.getElementById('lbl-layer').innerHTML='';

  shelfGroup = new THREE.Group();
  scene.add(shelfGroup);

  const {blocks, levels, spots} = S;
  const BW = spots * SPOT_W;
  const TOTAL_Z = levels * LEVEL_H + BEAM_H;
  const TOTAL_X_all = blocks * BW + blocks * (spots+1) * POST_S + (blocks-1) * BLOCK_GAP;

  camTarget.set(TOTAL_X_all/2 - POST_S/2, TOTAL_Z/2, SHELF_D/2);
  camRadius = Math.max(TOTAL_X_all, TOTAL_Z) * 1.65 + 3;
  updateCamera();

  addBox(shelfGroup, -3,-0.02,-2, TOTAL_X_all+6, 0.02, SHELF_D+4, matFloor, false, true);

  for(let b=0;b<blocks;b++){
    const bi=b+1;
    const rx = b*(BW + (spots+1)*POST_S + BLOCK_GAP);

    for(let pp=0;pp<=spots;pp++){
      const px=rx+pp*(SPOT_W+POST_S);
      addBox(shelfGroup, px,0,0, POST_S,TOTAL_Z,POST_S, matPost);
      addBox(shelfGroup, px,0,SHELF_D-POST_S, POST_S,TOTAL_Z,POST_S, matPost);
      addBox(shelfGroup, px,TOTAL_Z-POST_S,POST_S, POST_S,POST_S,SHELF_D-2*POST_S, matBeam);
      addBox(shelfGroup, px,0,POST_S, POST_S,POST_S,SHELF_D-2*POST_S, matBeam);
    }

    addXBrace(shelfGroup, rx+POST_S*0.5, POST_S, SHELF_D-POST_S, 0, TOTAL_Z);
    addXBrace(shelfGroup, rx+(spots)*(SPOT_W+POST_S)+POST_S*0.5, POST_S, SHELF_D-POST_S, 0, TOTAL_Z);

    const panelGeo=new THREE.BoxGeometry(0.012, TOTAL_Z, SHELF_D);
    const lpanel=new THREE.Mesh(panelGeo, matPanel);
    lpanel.position.set(rx+POST_S*0.5, TOTAL_Z/2, SHELF_D/2);
    shelfGroup.add(lpanel);
    const rpanel=new THREE.Mesh(panelGeo, matPanel);
    rpanel.position.set(rx+spots*(SPOT_W+POST_S)+POST_S*1.5, TOTAL_Z/2, SHELF_D/2);
    shelfGroup.add(rpanel);

    const bwGeo=new THREE.BoxGeometry(BW+spots*POST_S, TOTAL_Z, 0.012);
    const bwMat=new THREE.MeshStandardMaterial({color:0x2a4060,metalness:0.4,roughness:0.7});
    const bw=new THREE.Mesh(bwGeo, bwMat);
    bw.position.set(rx+POST_S+(BW+spots*POST_S)*0.5, TOTAL_Z/2, POST_S*0.5);
    shelfGroup.add(bw);
    for(let hy=0;hy<TOTAL_Z;hy+=0.25){
      const rib=new THREE.Mesh(new THREE.BoxGeometry(BW+spots*POST_S-0.02, 0.018, 0.025), new THREE.MeshStandardMaterial({color:0x1e3050,metalness:0.5,roughness:0.6}));
      rib.position.set(rx+POST_S+(BW+spots*POST_S)*0.5, hy, POST_S*0.5+0.015);
      shelfGroup.add(rib);
    }

    for(let e=0;e<levels;e++){
      const ei=levels-e;
      const gy=e*LEVEL_H;
      const fw=BW+spots*POST_S;
      addBox(shelfGroup, rx+POST_S, gy, 0, fw, BEAM_H, BEAM_D, matBeam);
      addBox(shelfGroup, rx+POST_S, gy, SHELF_D-BEAM_D, fw, BEAM_H, BEAM_D, matBeam);
      addRivets(shelfGroup, rx+POST_S+0.08, gy+BEAM_H*0.5, BEAM_D, fw-0.16, 'x', Math.max(2, spots*2));
      addBox(shelfGroup, rx+POST_S, gy+BEAM_H, POST_S*0.5, fw, 0.04, SHELF_D-POST_S, matWood);

      for(let pp=0;pp<spots;pp++){
        const pi=pp+1;
        const cx=rx+POST_S+pp*(SPOT_W+POST_S);
        const cy=gy+BEAM_H+0.04;
        const pct=getFill(bi,ei,pi);
        const isSel=S.sel&&S.sel.r===bi&&S.sel.e===ei&&S.sel.p===pi;
        const code=pad(bi)+'-'+pad(ei)+'-'+pad(pi);
        const M=0.10;
        const IW=SPOT_W-M*2;
        const ID=SHELF_D-M*2-POST_S;

        if(pct>=5){
          const maxH=CELL_H*0.72;
          const fh=maxH*(pct/100);
          addBox(shelfGroup, cx+M,cy,M+POST_S*0.5, IW,0.08,ID, matWood);
          for(let si=0;si<4;si++){
            addBox(shelfGroup, cx+M+si*(IW/4),cy+0.01,M+POST_S*0.5, 0.03,0.09,ID, new THREE.MeshStandardMaterial({color:0x6a4520,roughness:0.9}));
          }
          const boxM=getBoxMat(pct);
          const boxMesh=addBox(shelfGroup, cx+M,cy+0.08,M+POST_S*0.5, IW,fh,ID, boxM);
          if(isSel){
            boxMesh.material=boxM.clone();
            boxMesh.material.emissive=new THREE.Color(0x334466);
            boxMesh.material.emissiveIntensity=0.4;
            const outGeo=new THREE.BoxGeometry(IW+0.04,fh+0.04,ID+0.04);
            const outMesh=new THREE.Mesh(outGeo, new THREE.MeshBasicMaterial({color:0xffffff,wireframe:true,transparent:true,opacity:0.6}));
            outMesh.position.copy(boxMesh.position);
            shelfGroup.add(outMesh);
          }
        }

        const hitGeo=new THREE.BoxGeometry(SPOT_W, CELL_H, SHELF_D-POST_S);
        const hitMesh=new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({visible:false}));
        hitMesh.position.set(cx+SPOT_W/2, cy+CELL_H/2, SHELF_D/2);
        hitMesh.userData={block:bi, level:ei, spot:pi, code, pct};
        shelfGroup.add(hitMesh);
        hitMeshes.push(hitMesh);
      }
    }

    const gy_top=levels*LEVEL_H;
    const fw=BW+spots*POST_S;
    addBox(shelfGroup, rx+POST_S, gy_top, 0, fw, BEAM_H, BEAM_D, matBeam);
    addBox(shelfGroup, rx+POST_S, gy_top, SHELF_D-BEAM_D, fw, BEAM_H, BEAM_D, matBeam);

    labelData.push({
      pos: new THREE.Vector3(rx+POST_S+fw*0.5, TOTAL_Z+BEAM_H+0.35, SHELF_D*0.5),
      text: 'BLOCK '+pad(bi),
      cls: 'shelf-label block-label'
    });
  }

  buildHTMLLabels();
}

function buildHTMLLabels(){
  const layer=document.getElementById('lbl-layer');
  layer.innerHTML='';
  labelData.forEach((ld,i)=>{
    const div=document.createElement('div');
    div.className=ld.cls;
    div.textContent=ld.text;
    div.dataset.idx=i;
    div.style.position='absolute';
    layer.appendChild(div);
    ld.el=div;
  });
}

function updateLabelPositions(){
  const w=canvas.clientWidth, h=canvas.clientHeight;
  labelData.forEach(ld=>{
    if(!ld.el) return;
    const v=ld.pos.clone().project(camera);
    if(v.z>1){ld.el.style.display='none';return;}
    ld.el.style.display='block';
    ld.el.style.left=((v.x+1)/2*w).toFixed(1)+'px';
    ld.el.style.top=((-v.y+1)/2*h).toFixed(1)+'px';
  });
}

function onResize(){
  const wrap=document.querySelector('.cvs-wrap');
  const w=wrap.clientWidth, h=wrap.clientHeight;
  renderer.setSize(w,h,false);
  camera.aspect=w/h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);

let drag=false, lastMX=0, lastMY=0;
const wrap=document.querySelector('.cvs-wrap');
wrap.addEventListener('mousedown',e=>{drag=true;lastMX=e.clientX;lastMY=e.clientY;});
window.addEventListener('mousemove',e=>{
  if(!drag)return;
  const dx=e.clientX-lastMX, dy=e.clientY-lastMY;
  camTheta-=dx*0.008;
  camPhi=Math.max(0.1,Math.min(Math.PI*0.48,camPhi-dy*0.008));
  lastMX=e.clientX;lastMY=e.clientY;
  document.getElementById('rot-slider').value=((camTheta%(Math.PI*2)+Math.PI*2)%(Math.PI*2)*(180/Math.PI)).toFixed(0);
  updateCamera();
});
window.addEventListener('mouseup',()=>drag=false);
wrap.addEventListener('wheel',e=>{
  e.preventDefault();
  camRadius=Math.max(3,Math.min(25,camRadius+e.deltaY*0.01));
  updateCamera();
},{passive:false});

let lastTouch=null;
wrap.addEventListener('touchstart',e=>{lastTouch={x:e.touches[0].clientX,y:e.touches[0].clientY};},{passive:true});
wrap.addEventListener('touchmove',e=>{
  if(!lastTouch)return;
  const dx=e.touches[0].clientX-lastTouch.x, dy=e.touches[0].clientY-lastTouch.y;
  camTheta-=dx*0.01; camPhi=Math.max(0.1,Math.min(Math.PI*0.48,camPhi-dy*0.01));
  lastTouch={x:e.touches[0].clientX,y:e.touches[0].clientY};
  updateCamera();
},{passive:true});

document.getElementById('zi').onclick=()=>{camRadius=Math.max(3,camRadius-1);updateCamera();};
document.getElementById('zo').onclick=()=>{camRadius=Math.min(25,camRadius+1);updateCamera();};

document.getElementById('rot-slider').addEventListener('input',function(){
  camTheta=parseFloat(this.value)*Math.PI/180;
  updateCamera();
});
document.getElementById('rot-l').onclick=()=>{
  camTheta-=0.15; document.getElementById('rot-slider').value=((camTheta%(Math.PI*2)+Math.PI*2)%(Math.PI*2)*(180/Math.PI)).toFixed(0); updateCamera();
};
document.getElementById('rot-r').onclick=()=>{
  camTheta+=0.15; document.getElementById('rot-slider').value=((camTheta%(Math.PI*2)+Math.PI*2)%(Math.PI*2)*(180/Math.PI)).toFixed(0); updateCamera();
};

const raycaster=new THREE.Raycaster();
const mouse=new THREE.Vector2();
const tipEl=document.getElementById('tip');
const tc2El=document.getElementById('tc2');
const tfEl2=document.getElementById('tf');

wrap.addEventListener('click',e=>{
  if(Math.abs(e.clientX-lastMX)>3||Math.abs(e.clientY-lastMY)>3) return;
  const rect=wrap.getBoundingClientRect();
  mouse.x=((e.clientX-rect.left)/rect.width)*2-1;
  mouse.y=-((e.clientY-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera(mouse,camera);
  const hits=raycaster.intersectObjects(hitMeshes);
  if(hits.length>0){
    const d=hits[0].object.userData;
    S.sel={r:d.block,e:d.level,p:d.spot};
    if(window.ReactNativeWebView){
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'select',block:d.block,level:d.level,spot:d.spot,code:d.code,pct:d.pct}));
    }
  } else {
    S.sel=null;
  }
  buildScene();
});

wrap.addEventListener('mousemove',e=>{
  const rect=wrap.getBoundingClientRect();
  mouse.x=((e.clientX-rect.left)/rect.width)*2-1;
  mouse.y=-((e.clientY-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera(mouse,camera);
  const hits=raycaster.intersectObjects(hitMeshes);
  if(hits.length>0){
    const d=hits[0].object.userData;
    const pct=d.pct;
    tc2El.textContent=d.code;
    tfEl2.textContent=pct<5?'Leer':pct<=60?'OK: '+pct+'%':pct<=80?'Fast voll: '+pct+'%':'Ueberfuellt: '+pct+'%';
    tipEl.classList.add('on');
    tipEl.style.left=(e.clientX+16)+'px';
    tipEl.style.top=(e.clientY-14)+'px';
    wrap.style.cursor='pointer';
  } else {
    tipEl.classList.remove('on');
    wrap.style.cursor='grab';
  }
});
wrap.addEventListener('mouseleave',()=>tipEl.classList.remove('on'));

// Touch tap detection for mobile
let touchStartX=0, touchStartY=0, touchStartTime=0;
wrap.addEventListener('touchstart',e=>{
  touchStartX=e.touches[0].clientX;
  touchStartY=e.touches[0].clientY;
  touchStartTime=Date.now();
},{passive:true});
wrap.addEventListener('touchend',e=>{
  const dt=Date.now()-touchStartTime;
  const dx=Math.abs(e.changedTouches[0].clientX-touchStartX);
  const dy=Math.abs(e.changedTouches[0].clientY-touchStartY);
  if(dt<300&&dx<10&&dy<10){
    const rect=wrap.getBoundingClientRect();
    mouse.x=((e.changedTouches[0].clientX-rect.left)/rect.width)*2-1;
    mouse.y=-((e.changedTouches[0].clientY-rect.top)/rect.height)*2+1;
    raycaster.setFromCamera(mouse,camera);
    const hits=raycaster.intersectObjects(hitMeshes);
    if(hits.length>0){
      const d=hits[0].object.userData;
      S.sel={r:d.block,e:d.level,p:d.spot};
      if(window.ReactNativeWebView){
        window.ReactNativeWebView.postMessage(JSON.stringify({type:'select',block:d.block,level:d.level,spot:d.spot,code:d.code,pct:d.pct}));
      }
      buildScene();
    }
  }
},{passive:true});

let animTarget = null;
function animateTo(theta, phi, duration=380){
  const startTheta=camTheta, startPhi=camPhi, t0=performance.now();
  let dTheta = ((theta-startTheta+Math.PI*3)%(Math.PI*2))-Math.PI;
  function step(now){
    const t=Math.min(1,(now-t0)/duration);
    const ease=t<0.5?2*t*t:(4-2*t)*t-1;
    camTheta=startTheta+dTheta*ease;
    camPhi=startPhi+(phi-startPhi)*ease;
    updateCamera();
    if(t<1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

const ISO_PHI  = Math.PI*0.32;
const TOP_PHI  = 0.08;
const FRONT_PHI= Math.PI*0.42;

document.getElementById('vc-top').addEventListener('click', ()=>animateTo(camTheta, TOP_PHI));
document.getElementById('vc-front').addEventListener('click', ()=>animateTo(0, FRONT_PHI));
document.getElementById('vc-right').addEventListener('click', ()=>animateTo(Math.PI*0.5, FRONT_PHI));
document.getElementById('vc-iso').addEventListener('click', ()=>animateTo(Math.PI*0.3, ISO_PHI));
document.getElementById('vc-arc-l').addEventListener('click', ()=>animateTo(camTheta - Math.PI/6, camPhi, 300));
document.getElementById('vc-arc-r').addEventListener('click', ()=>animateTo(camTheta + Math.PI/6, camPhi, 300));
document.getElementById('vc-rot90l').addEventListener('click', ()=>animateTo(camTheta - Math.PI/2, camPhi, 400));
document.getElementById('vc-rot90r').addEventListener('click', ()=>animateTo(camTheta + Math.PI/2, camPhi, 400));
document.getElementById('vc-home').addEventListener('click', ()=>animateTo(Math.PI*0.3, Math.PI*0.32, 450));

{
  const cubeDiv=document.getElementById('vcube');
  let cubeDrag=false, cStartX=0, cStartY=0, cStartTheta=0, cStartPhi=0;
  cubeDiv.addEventListener('mousedown', e=>{
    cubeDrag=true; cStartX=e.clientX; cStartY=e.clientY;
    cStartTheta=camTheta; cStartPhi=camPhi;
    e.stopPropagation();
  });
  window.addEventListener('mousemove', e=>{
    if(!cubeDrag) return;
    const dx=e.clientX-cStartX, dy=e.clientY-cStartY;
    camTheta=cStartTheta - dx*0.022;
    camPhi=Math.max(0.06, Math.min(Math.PI*0.48, cStartPhi - dy*0.018));
    updateCamera();
  });
  window.addEventListener('mouseup', ()=>{ cubeDrag=false; });
}

['vc-top','vc-front','vc-right'].forEach(id=>{
  const el=document.getElementById(id);
  el.addEventListener('mouseenter',()=>{ el.setAttribute('opacity','0.75'); });
  el.addEventListener('mouseleave',()=>{ el.removeAttribute('opacity'); });
});

function animate(){
  requestAnimationFrame(animate);
  updateLabelPositions();
  renderer.render(scene,camera);
}

onResize();
buildScene();
updateCamera();
animate();
<\/script>
</body>
</html>`;
}

export default function ShelfVisualizer3D({ blocks, levels, spots, fillData, onSpotPress }: Props) {
  const html = useMemo(() => buildHtml(blocks, levels, spots, fillData), [blocks, levels, spots, fillData]);

  return (
    <View style={styles.container}>
      <WebView
        source={{ html }}
        style={styles.webview}
        javaScriptEnabled
        originWhitelist={['*']}
        mixedContentMode="always"
        allowsInlineMediaPlayback
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'select') {
              onSpotPress(data.block, data.level, data.spot, data.code, data.pct);
            }
          } catch {}
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111a26',
  },
  webview: {
    flex: 1,
    backgroundColor: '#111a26',
  },
});
