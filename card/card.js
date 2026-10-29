(async()=>{
'use strict';
const stage=document.querySelector('#stage'), card=document.querySelector('#card');
const flip=document.querySelector('#flip'),reset=document.querySelector('#reset'),flatButton=document.querySelector('#flat'),status=document.querySelector('#status'),hint=document.querySelector('#hint');
const motion=matchMedia('(prefers-reduced-motion: reduce)');
let flat=motion.matches,back=false,engine=null,loading=null,failed=false;
document.body.classList.add('enhanced','flat');
[flip,reset,flatButton].forEach(b=>b.hidden=false);
function sync(){
 document.body.classList.toggle('flat',flat||!engine);document.body.classList.toggle('three-ready',!!engine&&!flat);
 for(const side of ['front','back']){const visible=side===(back?'back':'front');const el=card.querySelector('.'+side);el.classList.toggle('is-visible',visible);el.setAttribute('aria-hidden',String(!visible));}
 flip.firstChild.textContent=back?'Show front ':'Flip card ';flatButton.setAttribute('aria-pressed',String(flat||!engine));
 hint.textContent=failed?'3D unavailable · both sides are available in flat view.':flat?'Flat view · use Flip card to see the other side.':engine?'Drag and release · turn to explore · double-tap to reset':'Preparing your card…';
 engine?.setActive(!flat);engine?.target(back);
}
async function enable(){if(engine||failed)return;if(loading)return loading;loading=build().then(e=>{engine=e;sync();}).catch(()=>{failed=true;flat=true;sync();});return loading;}
flip.addEventListener('click',()=>{back=!back;sync();status.textContent=back?'Back of card':'Front of card';});
reset.addEventListener('click',()=>{back=false;engine?.reset();sync();status.textContent='Card reset to front';});
flatButton.addEventListener('click',async()=>{flat=!flat;if(!flat)await enable();sync();});
motion.addEventListener('change',()=>{if(motion.matches){flat=true;sync();}});
sync();if(!flat)await enable();
async function build(){
 const T=await import('./vendor/three.module.min.js');
 const renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(Math.max(devicePixelRatio,2),3));renderer.outputColorSpace=T.SRGBColorSpace;
 const canvas=renderer.domElement;canvas.setAttribute('aria-hidden','true');canvas.className='card-canvas';
 const loader=new T.TextureLoader();let textures;
 try{textures=await Promise.all(['front.webp?v=print2','back.webp?v=print2','paper-grain.svg'].map(url=>loader.loadAsync(url)));}catch(e){renderer.dispose();throw e;}
 const [frontMap,backMap,grain]=textures;
 [frontMap,backMap].forEach(t=>{t.colorSpace=T.SRGBColorSpace;t.anisotropy=renderer.capabilities.getMaxAnisotropy();});
 grain.wrapS=grain.wrapT=T.RepeatWrapping;grain.repeat.set(7,4);
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(33,1,.1,50);camera.position.z=6.2;
 scene.add(new T.HemisphereLight(0xffffff,0x888888,1.8));
 const light=new T.DirectionalLight(0xffffff,1.5);light.position.set(-4,6,7);scene.add(light);
 const rim=new T.DirectionalLight(0xe4e9ed,1.8);rim.position.set(4,2,-4);scene.add(rim);
 const group=new T.Group();scene.add(group);
 const w=4.8,h=w*172.913/272.126,r=.035;
 function outline(){const s=new T.Shape();s.moveTo(-w/2+r,-h/2);s.lineTo(w/2-r,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);s.lineTo(w/2,h/2-r);s.quadraticCurveTo(w/2,h/2,w/2-r,h/2);s.lineTo(-w/2+r,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);return s;}
 const coreGeo=new T.ExtrudeGeometry(outline(),{depth:.035,bevelEnabled:true,bevelSize:.008,bevelThickness:.006,bevelSegments:2,steps:1,curveSegments:8});coreGeo.translate(0,0,-.0175);
 const core=new T.Mesh(coreGeo,new T.MeshStandardMaterial({color:0x363936,roughness:.85}));group.add(core);
 const faceGeo=new T.ShapeGeometry(outline(),12);const pos=faceGeo.attributes.position,uv=faceGeo.attributes.uv;
 for(let i=0;i<pos.count;i++)uv.setXY(i,(pos.getX(i)+w/2)/w,(pos.getY(i)+h/2)/h);
 for(let i=0;i<2;i++){
  const mat=new T.MeshPhysicalMaterial({map:i?backMap:frontMap,roughness:.82,metalness:0,specularIntensity:.08,clearcoat:0,bumpMap:grain,bumpScale:.00035});
  const face=new T.Mesh(faceGeo,mat);face.position.z=i?-.025:.025;if(i)face.rotation.y=Math.PI;group.add(face);
 }
 stage.append(canvas);
 let x=0,y=0,vx=0,vy=0,tx=0,ty=0,drag=null,frame=0,last=0,active=true,inView=true;
 const clamp=T.MathUtils.clamp;
 function draw(){group.rotation.set(x,y,0,'YXZ');group.position.set(0,0,0);renderer.render(scene,camera);}
 function tick(now){frame=0;if(!active||!inView||document.hidden)return;const dt=Math.min((now-last)/1000||.016,.032);last=now;
  if(!drag){vx+=(30*(tx-x)-7*vx)*dt;vy+=(30*(ty-y)-7*vy)*dt;x+=vx*dt;y+=vy*dt;}
  draw();if(drag||Math.abs(tx-x)+Math.abs(ty-y)+Math.abs(vx)+Math.abs(vy)>.001)frame=requestAnimationFrame(tick);
 }
 function wake(){if(!frame&&active&&inView&&!document.hidden){last=performance.now();frame=requestAnimationFrame(tick);}}
 function resize(){
  const b=stage.getBoundingClientRect();if(!b.width||!b.height)return;
  renderer.setSize(b.width,b.height,false);camera.aspect=b.width/b.height;
  // Fit the entire rotation envelope, including corners that move toward the camera.
  // Fitting only the flat face clips the nearer edge against the canvas when turned.
  const radius=Math.hypot(w/2+.008,h/2+.008,.025);
  const verticalHalfFov=T.MathUtils.degToRad(camera.fov/2);
  const horizontalHalfFov=Math.atan(Math.tan(verticalHalfFov)*camera.aspect);
  // YXZ rotation keeps vertical extent within the short edge's radius.
  const maxY=Math.hypot(h/2+.008,.025);
  const verticalFit=Math.sqrt(radius*radius-maxY*maxY)+maxY/Math.tan(verticalHalfFov);
  const horizontalFit=radius/Math.sin(horizontalHalfFov);
  camera.position.z=Math.max(verticalFit,horizontalFit)*1.04;
  camera.updateProjectionMatrix();draw();
 }
 const observer=new ResizeObserver(resize);observer.observe(stage);
 const intersection=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;if(inView)wake();else{cancelAnimationFrame(frame);frame=0;}});intersection.observe(stage);
 const ray=new T.Raycaster(),pointer=new T.Vector2();
 canvas.addEventListener('pointerdown',e=>{if(!active||e.button!==0)return;const b=canvas.getBoundingClientRect();pointer.set((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1);ray.setFromCamera(pointer,camera);if(!ray.intersectObject(group,true).length)return;
 drag={id:e.pointerId,px:e.clientX,py:e.clientY,t:performance.now()};vx=vy=0;canvas.setPointerCapture(e.pointerId);stage.classList.add('dragging');wake();});
 canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const now=performance.now(),dt=Math.max(.008,(now-drag.t)/1000),dx=(e.clientX-drag.px)*.009,dy=(e.clientY-drag.py)*.007;x=clamp(x+dy,-.7,.7);y+=dx;vx=clamp(dy/dt,-3,3);vy=clamp(dx/dt,-4,4);drag={...drag,px:e.clientX,py:e.clientY,t:now};draw();});
 function release(){if(!drag)return;drag=null;stage.classList.remove('dragging');const side=Math.round(y/Math.PI);back=Math.abs(side%2)===1;tx=0;ty=side*Math.PI;sync();wake();}
 ['pointerup','pointercancel','lostpointercapture'].forEach(name=>canvas.addEventListener(name,release));
 canvas.addEventListener('dblclick',()=>{back=false;sync();});
 const visibility=()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;drag=null;stage.classList.remove('dragging');}else wake();};document.addEventListener('visibilitychange',visibility);
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();failed=true;flat=true;sync();});
 const api={setActive(value){active=value;if(!value){cancelAnimationFrame(frame);frame=0;drag=null;stage.classList.remove('dragging');}else{resize();wake();}},target(isBack){const base=isBack?Math.PI:0;ty=base+Math.round((y-base)/(2*Math.PI))*2*Math.PI;tx=0;wake();},reset(){vx=vy=0;tx=0;ty=0;},dispose(){cancelAnimationFrame(frame);observer.disconnect();intersection.disconnect();document.removeEventListener('visibilitychange',visibility);scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});textures.forEach(t=>t.dispose());renderer.dispose();canvas.remove();}};
 window.addEventListener('pagehide',e=>{if(!e.persisted)api.dispose();});resize();draw();return api;
}
})();
