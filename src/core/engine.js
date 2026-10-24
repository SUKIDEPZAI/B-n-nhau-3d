// Engine: renderer, bầu trời, ánh sáng mặt trời có bóng bám theo người chơi, sương mù, viewmodel pass.
import * as THREE from 'three';

export const QUALITY = {
  low: { pr: 1, shadow: 0, shadowSize: 1024, pbr: false, tex: 256, aniso: 1 },
  med: { pr: 1.4, shadow: 1, shadowSize: 1024, pbr: true, tex: 512, aniso: 4 },
  high: { pr: 2, shadow: 1, shadowSize: 2048, pbr: true, tex: 512, aniso: 8 },
};

const SKY_VS = 'varying vec3 vD;void main(){vD=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position.z=gl_Position.w;}';
const SKY_FS = `varying vec3 vD;uniform vec3 uSun;uniform vec3 uZ;uniform vec3 uM;uniform vec3 uH;
float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x),f.y);}
float fb(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*n2(p);p*=2.03;a*=.5;}return s;}
void main(){vec3 d=normalize(vD);float h=d.y;
vec3 c=mix(uH,uM,smoothstep(0.,.22,h));c=mix(c,uZ,smoothstep(.18,.85,h));c=mix(c,uH*.9,smoothstep(0.,-.12,h));
float sd=max(dot(d,uSun),0.);c+=vec3(1.,.82,.55)*(pow(sd,900.)*3.+pow(sd,14.)*.22+pow(sd,3.)*.1);
if(h>.015){vec2 p=d.xz/(h+.28)*1.7;float k=smoothstep(.5,.82,fb(p*1.2+3.));c=mix(c,vec3(1.,.96,.9)*(.82+.2*h),k*.55*smoothstep(.015,.2,h));}
gl_FragColor=vec4(c,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;

export class Engine {
  constructor(canvas, quality = 'med') {
    this.canvas = canvas;
    this.q = QUALITY[quality];
    this.qName = quality;
    const mobile = matchMedia('(pointer:coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance', alpha: false });
    const r = this.renderer;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = this.q.shadow > 0;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.autoClear = false;
    this.scale = 1;
    this.maxPR = Math.min(window.devicePixelRatio || 1, this.q.pr);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(65, 1, 0.08, 500);
    this.vmScene = new THREE.Scene();
    this.vmCamera = new THREE.PerspectiveCamera(52, 1, 0.01, 10);
    this.vmScene.add(this.vmCamera);
    this.showVM = false;

    // bầu trời (độ cao mặt trời ~30°, ấm như ảnh tham chiếu)
    this.sunDir = new THREE.Vector3(-0.55, 0.5, 0.45).normalize();
    const skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uSun: { value: this.sunDir }, uZ: { value: new THREE.Color(0x4f6f9a) }, uM: { value: new THREE.Color(0x93aac6) }, uH: { value: new THREE.Color(0xf0e2c8) } },
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 16), skyMat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);
    this.scene.fog = new THREE.Fog(0xe6dcc6, 90, 330);

    // môi trường PBR từ chính bầu trời
    const pm = new THREE.PMREMGenerator(r);
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(this.sky.geometry, skyMat));
    this.scene.environment = pm.fromScene(envScene, 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    pm.dispose();

    this.hemi = new THREE.HemisphereLight(0xbfd2ea, 0x8f7c5c, 0.85);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffe7c4, 3.1);
    this.sun.castShadow = this.q.shadow > 0;
    const sh = this.sun.shadow;
    sh.mapSize.set(this.q.shadowSize, this.q.shadowSize);
    sh.camera.left = sh.camera.bottom = -42; sh.camera.right = sh.camera.top = 42;
    sh.camera.near = 1; sh.camera.far = 260;
    sh.bias = -0.0004; sh.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target);
    this.vmScene.add(new THREE.HemisphereLight(0xbfd2ea, 0x8f7c5c, 1.1));
    const vs = new THREE.DirectionalLight(0xffe7c4, 2.6); vs.position.set(-1, 2, 1.5); this.vmScene.add(vs);
    this.vmScene.environment = this.scene.environment; this.vmScene.environmentIntensity = 0.7;
    this.resize();
    addEventListener('resize', () => this.resize());
  }
  setScale(s) { this.scale = Math.max(0.55, Math.min(1, s)); this.resize(); }
  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setPixelRatio(this.maxPR * this.scale);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.vmCamera.aspect = w / h; this.vmCamera.updateProjectionMatrix();
  }
  /** Bóng bám theo (cx,cz), làm tròn theo texel để không rung. */
  followShadow(cx, cy, cz) {
    const t = 84 / this.q.shadowSize, d = this.sunDir;
    const sx = Math.round(cx / t) * t, sz = Math.round(cz / t) * t;
    this.sun.target.position.set(sx, 0, sz);
    this.sun.position.set(sx + d.x * 120, d.y * 120, sz + d.z * 120);
    this.sun.target.updateMatrixWorld();
    this.sky.position.copy(this.camera.position);
  }
  render() {
    const r = this.renderer;
    r.clear();
    r.render(this.scene, this.camera);
    if (this.showVM) { r.clearDepth(); r.render(this.vmScene, this.vmCamera); }
  }
}
