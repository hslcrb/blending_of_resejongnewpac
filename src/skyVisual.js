import * as THREE from 'three';

// [서울 낮과 밤 하늘 / Seoul day and night sky]
// 별은 시각화이며 실제 별자리나 현장 사진이 아닙니다.
// Stars are illustrative, not a measured celestial catalogue.
export function createSkyMaterial() {
 return new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false,
  uniforms: { sunDir: {value:new THREE.Vector3(0,1,0)}, moonDir: {value:new THREE.Vector3(0,-1,0)}, moonIllumination: {value:0}, daylight:{value:1}, cloudAmount:{value:.15}, starRotation:{value:0} },
  vertexShader: `varying vec3 vDirection; void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader: `
   varying vec3 vDirection;
   uniform vec3 sunDir; uniform vec3 moonDir; uniform float moonIllumination;
   uniform float daylight; uniform float cloudAmount; uniform float starRotation;
   float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+1.0),f.x),f.y);}
   float fbm(vec2 p){float v=0.0;float w=.5;for(int i=0;i<3;i++){v+=noise(p)*w;p=p*2.03+7.4;w*=.5;}return v;}
   void main(){
    vec3 d=normalize(vDirection);float elevation=clamp(d.y*.65+.45,.05,1.0);
    vec3 dayColor=mix(vec3(.46,.72,.90),vec3(.10,.37,.72),pow(elevation,.65));
    vec3 nightColor=mix(vec3(.055,.075,.14),vec3(.012,.024,.065),pow(elevation,.65));
    vec3 color=mix(nightColor,dayColor,daylight);
    vec2 clouds=d.xz/(max(d.y+.45,.05)+.32)*1.65;
    float cloud=smoothstep(.48,.69,fbm(clouds+vec2(3.5,1.8)))*smoothstep(-.55,-.15,d.y)*cloudAmount;
    vec2 starGrid=vec2(atan(d.z,d.x)+starRotation,asin(clamp(d.y,-1.0,1.0)))*72.0;
    vec2 cell=floor(starGrid), f=fract(starGrid);
    float starChance=hash(cell);vec2 starAt=vec2(hash(cell+14.2),hash(cell+91.7))*.72+.14;
    float star=(1.0-smoothstep(.015,.095,length(f-starAt)))*smoothstep(.975,.992,starChance);
    color+=vec3(.7,.78,.95)*star*(1.0-daylight)*(1.0-cloud)*smoothstep(.02,.16,d.y)*.42;
    vec3 moon=normalize(moonDir);float alignment=dot(d,moon);
    vec3 tangent=normalize(cross(moon,vec3(0.0,1.0,0.0001)));
    float side=dot(d-moon,tangent)/.012;
    float phase=smoothstep(1.0-2.0*moonIllumination-.08,1.0-2.0*moonIllumination+.08,side);
    float moonDisk=smoothstep(.99990,.99993,alignment)*phase;
    float moonGlow=pow(max(alignment,0.0),900.0)*moonIllumination*.12;
    float moonVisibility=(1.0-daylight)*(1.0-cloud)*smoothstep(-.02,.03,moon.y);
    color+=(vec3(.96,.93,.81)*moonDisk*.9+vec3(.65,.72,.9)*moonGlow)*moonVisibility;
    color=mix(color,mix(vec3(.10,.12,.17),vec3(1.0,.99,.97),daylight),cloud);
    float sunlight=pow(max(dot(d,normalize(sunDir)),0.0),128.0);color+=vec3(.45,.36,.23)*sunlight*daylight;
    gl_FragColor=vec4(color,1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`,
 });
}

// Warm local lighting follows the campus transform and fades in after sunset.
export function createCampusNightLights() {
 const group=new THREE.Group();const lights=[];
 for(const [x,y,z] of [[-25,9,32],[5,10,38],[36,9,32],[-53,8,-12]]){
  const light=new THREE.PointLight(0xffca91,0,90,2);light.position.set(x,y,z);group.add(light);lights.push(light);
 }
 return {group, setIntensity(value){for(const light of lights)light.intensity=value;}};
}
