import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import * as THREE from 'three';
import {createNationalMapRenderer} from '../src/nationalMapRenderer.js';
import {NationalMapInformation} from '../src/NationalMapInformation.jsx';
import {createNationalMapSource} from '../src/nationalMapLayers.js';
function Harness(){
 const host=useRef(null),map=useRef(null),[status,setStatus]=useState('준비 중'),[hits,setHits]=useState([]);
 useEffect(()=>{
  const el=host.current,scene=new THREE.Scene();scene.background=new THREE.Color('#dceee8');
  const w=el.clientWidth,h=el.clientHeight,camera=new THREE.OrthographicCamera(-15000*w/h,15000*w/h,15000,-15000,1,80000);
  camera.position.set(-18506,23000,17032);camera.lookAt(-18506,0,-968);camera.updateProjectionMatrix();camera.updateMatrixWorld();
  const webgl=new THREE.WebGLRenderer({antialias:true});webgl.setPixelRatio(Math.min(devicePixelRatio,1.5));webgl.setSize(w,h);el.appendChild(webgl.domElement);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(60000,60000),new THREE.MeshBasicMaterial({color:'#eaf4ed'}));ground.rotation.x=-Math.PI/2;ground.position.set(-18506,-2,-968);scene.add(ground);
  let r;const draw=()=>{webgl.render(scene,camera);r?.paint()};
  r=createNationalMapRenderer({scene,camera,host:el,draw,onStatus:x=>setStatus(x.message),onInspect:setHits});map.current=r;
  r.update({layers:['airports','temples','national-parks','watercourses','metro-boundaries'],bounds:[175000,545000,190000,560000],mode:'seoul',sight:true}).then(()=>{
   draw();window.__mapStats={objects:scene.children[1].children.length,vertices:scene.children[1].children.reduce((n,o)=>n+o.geometry.attributes.position.count,0),calls:webgl.info.render.calls};
  }).catch(()=>{});
  return ()=>{r.dispose();ground.geometry.dispose();ground.material.dispose();webgl.dispose();webgl.domElement.remove()};
 },[]);
 return <main className="test-wrap"><h1>실제 백지도 검사</h1><p role="status">{status}</p><div className="stage" ref={host}/><button onClick={()=>void map.current?.inspectAt({easting:181494.2,northing:550968.2,radius:100})}>돋보기 위치 검사</button><button onClick={async()=>{const records=await createNationalMapSource().query({layers:['ski-resorts'],includeUnlocated:true});setHits(records.filter(f=>!f.geometry).map(feature=>({feature,distance:null,contains:false})))}}>미위치 원본 검사</button><NationalMapInformation hits={hits}/></main>;
}
createRoot(document.getElementById('root')).render(<Harness/>);
