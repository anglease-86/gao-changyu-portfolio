import * as THREE from 'three';

const canvas = document.getElementById('sculpture');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let renderer;

try {
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050505);
  const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, .1, 60);
  camera.position.z = 10;
  const group = new THREE.Group();
  scene.add(group);

  // The glass reflects a small photographic lighting rig rather than a flat tint.
  const studio = new THREE.Scene();
  studio.background = new THREE.Color(0x080808);
  const panels = [
    [1.1, 8, [-4, 2, 4], 0xe9f2ff, 5], [.4, 6, [3, 0, 4], 0xadbfff, 4],
    [7, 1, [0, 5, 2], 0xffffff, 5], [5, .25, [0, -3, 3], 0xc4e9ec, 3],
    [.5, 7, [-2, 0, -4], 0x9185c7, 2]
  ];
  panels.forEach(([width, height, position, color, intensity]) => {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide, toneMapped: false }));
    panel.position.set(...position);
    panel.lookAt(0, 0, 0);
    studio.add(panel);
  });
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(studio, .025);
  scene.environment = environment.texture;
  studio.children.forEach(panel => { panel.geometry.dispose(); panel.material.dispose(); });
  pmrem.dispose();
  const key = new THREE.DirectionalLight(0xe8f4ff, 3);
  key.position.set(-3, 4, 5);
  const coolFill = new THREE.PointLight(0x638a9c, 9, 12, 2);
  coolFill.position.set(2.8, .5, 2.7);
  const warmFill = new THREE.PointLight(0x84627e, 5, 10, 2);
  warmFill.position.set(-2, -1.8, 1.7);
  scene.add(key, coolFill, warmFill, new THREE.AmbientLight(0xffffff, .4));

  const construction = new THREE.Group();
  group.add(construction);
  function line(points, opacity = .14, color = 0xb7bec5, dashed = false) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points.map(point => new THREE.Vector3(...point)));
    const material = dashed
      ? new THREE.LineDashedMaterial({ color, transparent: true, opacity, dashSize: .018, gapSize: .024, depthWrite: false })
      : new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    const object = new THREE.Line(geometry, material);
    if (dashed) object.computeLineDistances();
    construction.add(object);
    return object;
  }
  function circle(radius, opacity, rotation = 0) {
    const points = Array.from({ length: 181 }, (_, index) => {
      const angle = index / 180 * Math.PI * 2;
      return [Math.cos(angle) * radius, Math.sin(angle) * radius, -.26];
    });
    const object = line(points, opacity, 0xa7b5bd, true);
    object.rotation.x = rotation;
    return object;
  }
  const edgeMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uTint: { value: new THREE.Color(0x85ced0) } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform vec3 uTint;
      void main(){
        float d=abs(fract(vUv.x-uTime*.075)-.5);
        float pulse=exp(-d*d*210.);
        float width=exp(-pow((vUv.y-.5)*2.,2.)*4.);
        vec3 color=mix(vec3(.36,.43,.47),uTint,.45+pulse*.5);
        gl_FragColor=vec4(color,width*(.26+pulse*.68));
        #include <colorspace_fragment>
      }
    `,
    transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,blending:THREE.AdditiveBlending
  });
  const frameMaterial = new THREE.LineBasicMaterial({ color: 0xcbd4da, transparent: true, opacity: .54, depthTest: false, depthWrite: false });
  const prismFrame = new THREE.Group();
  const outerTriangle = [[0, 1.65], [-1.55, -1.12], [1.55, -1.12]];
  const innerTriangle = [[0, 1.13], [-1.18, -.91], [1.18, -.91]];
  const depth = .52;
  for (const [points, opacity] of [[outerTriangle, .6], [innerTriangle, .32]]) {
    for (const z of [-depth, depth]) {
      const geometry = new THREE.BufferGeometry().setFromPoints(points.map(([x, y]) => new THREE.Vector3(x, y - .12, z)));
      const loop = new THREE.LineLoop(geometry, frameMaterial.clone());
      loop.material.opacity = opacity;
      loop.renderOrder = 2;
      prismFrame.add(loop);
    }
  }
  const depthLinks = [];
  outerTriangle.forEach(([x, y], index) => {
    for (const point of [outerTriangle[index], innerTriangle[index]]) {
      const [px, py] = point;
      const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(px, py - .12, -depth), new THREE.Vector3(px, py - .12, depth)]);
      const link = new THREE.Line(geometry, frameMaterial.clone());
      link.material.opacity = .28;
      link.renderOrder = 2;
      prismFrame.add(link);
    }
    const [ix, iy] = innerTriangle[index];
    const depthGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, y - .12, depth),
      new THREE.Vector3(ix, iy - .12, -depth)
    ]);
    const depthLink = new THREE.Line(depthGeometry, frameMaterial.clone());
    depthLink.material.opacity = .19;
    depthLink.renderOrder = 1;
    prismFrame.add(depthLink);
    depthLinks.push(depthLink);
  });
  group.add(prismFrame);
  circle(1.85, .12); circle(.94, .1);
  const orbit = circle(2.12, .17, Math.PI * .42);
  const vertices = [[0, 1.53, -.28], [-1.55, -1.24, -.28], [1.55, -1.24, -.28]];
  vertices.forEach((point, index) => {
    const start = new THREE.Vector3(...point);
    const direction = new THREE.Vector3(...vertices[(index + 1) % vertices.length]).sub(start).normalize();
    for (const offset of [-.055, .055]) {
      const normal = new THREE.Vector3(-direction.y, direction.x, 0).multiplyScalar(offset);
      line([start.clone().addScaledVector(direction, -5).add(normal).toArray(), start.clone().addScaledVector(direction, 7).add(normal).toArray()], .055);
    }
    line([[point[0], -6, -.3], [point[0], 6, -.3]], .065);
    line([[-8, point[1], -.3], [8, point[1], -.3]], .065);
    line([[0, -.1, -.28], point], .1, 0xc2c7cd, true);
  });
  line([[-6, -.85, -.3], [6, -.85, -.3]], .085);
  const grid = new THREE.GridHelper(10, 30, 0x454950, 0x23262b);
  grid.material.transparent = true; grid.material.opacity = .1;
  grid.position.set(0, -1.26, -1.5);
  construction.add(grid);

  // Fine optical lines trace three edges of the open frame.
  const uniforms = { uTime: { value: 0 } };
  const filamentMaterial = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      vec3 spectral(float t) {
        vec3 c = .52 + .48 * cos(6.283185 * (t + vec3(.06, .39, .66)));
        return mix(c, vec3(.86,.94,1.), .16);
      }
      void main() {
        float x = abs(vUv.y-.5)*2.;
        float core = exp(-x*x*180.);
        float shoulder = exp(-x*x*11.);
        float taper = smoothstep(0.,.04,vUv.x)*(1.-smoothstep(.95,1.,vUv.x));
        float flow = .5+.5*sin(vUv.x*9.-uTime*.8);
        float breath = .5+.5*sin(uTime*1.35 + vUv.x*5. + sin(vUv.x*3.)*.8);
        vec3 color = spectral(vUv.x*.82-uTime*.035);
        color = mix(color,vec3(1.),core*.5);
        gl_FragColor=vec4(color,(core*.9+shoulder*.25)*taper*(.48+.34*flow+.28*breath));
        #include <colorspace_fragment>
      }
    `,
    transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, toneMapped: false
  });
  const haloMaterial = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      vec3 spectral(float t) { return .5 + .5 * cos(6.283185 * (t + vec3(.06, .39, .66))); }
      void main() {
        float x = abs(vUv.y-.5)*2.;
        float halo = exp(-x*x*3.2);
        float core = exp(-x*x*18.);
        float taper = smoothstep(0.,.04,vUv.x)*(1.-smoothstep(.95,1.,vUv.x));
        float flow = .5+.5*sin(vUv.x*8.-uTime*.7);
        float breath = .5+.5*sin(uTime*1.2 + vUv.x*4. + .5);
        vec3 color = mix(spectral(vUv.x*.7-uTime*.025), vec3(.8,.94,1.), .35);
        gl_FragColor=vec4(color,(halo*.16+core*.1)*taper*(.38+.35*flow+.27*breath));
        #include <colorspace_fragment>
      }
    `,
    transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, toneMapped: false
  });
  function lightFilament(from, to, width, haloWidth = width * 2.8, renderOrder = 3) {
    const start = new THREE.Vector3(...from), end = new THREE.Vector3(...to);
    const side = new THREE.Vector3().subVectors(end, start).normalize();
    side.set(-side.y, side.x, 0).multiplyScalar(width);
    const points = [start.clone().sub(side), start.clone().add(side), end.clone().sub(side), end.clone().add(side)];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flatMap(point => point.toArray()), 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0,0,0,1,1,0,1,1], 2));
    geometry.setIndex([0,2,1,2,3,1]);
    const haloSide = side.clone().normalize().multiplyScalar(haloWidth);
    const haloPoints = [start.clone().sub(haloSide), start.clone().add(haloSide), end.clone().sub(haloSide), end.clone().add(haloSide)];
    const haloGeometry = new THREE.BufferGeometry();
    haloGeometry.setAttribute('position', new THREE.Float32BufferAttribute(haloPoints.flatMap(point => point.toArray()), 3));
    haloGeometry.setAttribute('uv', new THREE.Float32BufferAttribute([0,0,0,1,1,0,1,1], 2));
    haloGeometry.setIndex([0,2,1,2,3,1]);
    const haloMesh = new THREE.Mesh(haloGeometry, haloMaterial);
    haloMesh.renderOrder = renderOrder - 1;
    group.add(haloMesh);
    const filamentMesh = new THREE.Mesh(geometry, filamentMaterial);
    filamentMesh.renderOrder = renderOrder;
    group.add(filamentMesh);
  }
  lightFilament([-1.55,-1.24,depth+.03], [0,1.53,depth+.03], .055, .15, 4);
  lightFilament([0,1.53,depth+.03], [1.55,-1.24,depth+.03], .041, .115, 4);
  lightFilament([-1.55,-1.24,depth+.03], [1.55,-1.24,depth+.03], .028, .08, 4);
  // The rear frame uses the same luminous strips at a stronger width so it remains
  // legible when the sculpture turns away from the viewer.
  lightFilament([-1.55,-1.24,-depth-.03], [0,1.53,-depth-.03], .044, .12, 3);
  lightFilament([0,1.53,-depth-.03], [1.55,-1.24,-depth-.03], .032, .09, 3);
  lightFilament([-1.55,-1.24,-depth-.03], [1.55,-1.24,-depth-.03], .022, .065, 3);

  let sections = [], heroTravel = 1, targetY = scrollY, visualY = targetY;
  let intro = document.body.classList.contains('is-revealed') ? 1 : 0;
  let introTarget = intro, paused = false, raf = 0, lastTime = 0, elapsed = 0, previousState = '';
  const pointer = new THREE.Vector2(), targetPointer = new THREE.Vector2();
  const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
  const smooth = value => value * value * (3 - 2 * value);
  function measure() {
    sections = [...document.querySelectorAll('main [data-section]')].map(element => ({ id: element.id, top: element.offsetTop, height: element.offsetHeight }));
    heroTravel = Math.max(1, document.getElementById('home').offsetHeight - innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    renderer.setSize(innerWidth, innerHeight);
    previousState = '';
  }
  measure();
  function composition(y, mobile) {
    const find = id => sections.find(section => section.id === id);
    const works = find('works'), about = find('about'), method = find('method'), contact = find('contact');
    const worksEntry = works.top + Math.min(innerHeight * .2, works.height * .2);
    const worksExit = Math.max(worksEntry + 1, works.top + works.height - Math.min(innerHeight * .35, works.height * .35));
    const aboutEntry = Math.max(about.top - innerHeight * .2, worksExit + 1);
    const frames = mobile ? [
      [0,.56,.71,.11,-.15,.08,1], [heroTravel,.5,.47,.19,.4,1.2,.7],
      [worksEntry,.55,.53,.28,.6,2.6,.24],
      [worksExit,.5,.43,.3,.8,5.5,.16],
      [aboutEntry,.62,.26,.13,.15,6.4,.8],
      [method.top-innerHeight*.2,.75,.28,.15,.3,8,.22],
      [contact.top-innerHeight*.2,.65,.55,.25,.2,9.3,.22]
    ] : [
      [0,.73,.49,.18,-.08,-.2,1], [heroTravel,.61,.49,.26,.35,1.1,.8],
      [worksEntry,.5,.51,.3,.6,2.6,.24],
      [worksExit,.25,.5,.23,.8,5.5,.18],
      [aboutEntry,.26,.48,.18,.08,6.4,1],
      [method.top-innerHeight*.2,.79,.38,.21,.3,8,.45],
      [contact.top-innerHeight*.2,.75,.53,.29,.2,9.3,.32]
    ];
    let index = 0;
    while (index < frames.length-2 && y > frames[index+1][0]) index++;
    const a = frames[index], b = frames[index+1];
    const t = smooth(clamp((y-a[0])/Math.max(1,b[0]-a[0]),0,1));
    return a.map((value,i) => lerp(value,b[i],t));
  }
  function frame(time) {
    raf = requestAnimationFrame(frame);
    const delta = Math.min((time-lastTime)/1000 || .016, .05);
    lastTime = time;
    const animated = !reducedMotion.matches && !paused;
    if (animated) elapsed += delta;
    // A hash link can bypass the opening overlay before its custom event fires.
    // Mirror the body state so the scene cannot remain transparent on deep links.
    if (document.body.classList.contains('is-revealed')) introTarget = 1;
    visualY = reducedMotion.matches ? targetY : lerp(visualY,targetY,1-Math.exp(-delta*9));
    intro = reducedMotion.matches ? 1 : lerp(intro,introTarget,1-Math.exp(-delta*6));
    pointer.lerp(paused ? new THREE.Vector2() : targetPointer,1-Math.exp(-delta*5));
    const state = [visualY.toFixed(1),intro.toFixed(3),pointer.x.toFixed(3),pointer.y.toFixed(3),Math.floor(elapsed*30)].join('/');
    if (state === previousState) return;
    previousState = state;
    const mobile = innerWidth <= 760;
    const [,x,y,size,rx,ry,opacity] = composition(visualY,mobile);
    const viewHeight = 2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.position.z;
    const viewWidth = viewHeight*camera.aspect;
    group.position.set((x-.5)*viewWidth,(.5-y)*viewHeight,0);
    group.scale.setScalar(Math.min(viewHeight*size,viewWidth*(mobile ? .25 : .19))*lerp(.9,1,smooth(intro)));
    group.rotation.set(rx+pointer.y*.09+Math.sin(elapsed*.23)*.035,ry+pointer.x*.16+elapsed*.14+Math.sin(elapsed*.19)*.12,Math.sin(elapsed*.17)*.025);
    orbit.rotation.z = elapsed*.025;
    construction.rotation.y = Math.sin(elapsed*.15)*.045;
    depthLinks.forEach((link, index) => {
      link.material.opacity = .14 + (.05 * (.5 + .5 * Math.sin(elapsed * .8 + index)));
    });
    uniforms.uTime.value = elapsed;
    canvas.style.opacity = String(opacity*smooth(intro));
    renderer.render(scene,camera);
    document.documentElement.classList.add('webgl-ready');
  }
  window.addEventListener('portfolio:scroll',({ detail }) => {
    targetY = detail.y; heroTravel = detail.heroTravel; sections = detail.sections;
  });
  window.addEventListener('scroll',() => { targetY = scrollY; },{ passive:true });
  window.addEventListener('resize',measure,{ passive:true });
  window.addEventListener('pointermove',event => {
    if (event.pointerType === 'touch') return;
    targetPointer.set((event.clientX/innerWidth-.5)*2,(event.clientY/innerHeight-.5)*2);
  },{ passive:true });
  document.documentElement.addEventListener('pointerleave',() => targetPointer.set(0,0));
  window.addEventListener('portfolio:intro-start',() => { intro = 0; introTarget = 0; });
  window.addEventListener('portfolio:intro-end',() => { introTarget = 1; });
  window.addEventListener('portfolio:motion',({ detail }) => { paused = detail.paused; previousState = ''; });
  reducedMotion.addEventListener('change',() => { previousState = ''; measure(); });
  document.addEventListener('visibilitychange',() => {
    cancelAnimationFrame(raf);
    if (!document.hidden) { lastTime = performance.now(); raf = requestAnimationFrame(frame); }
  });
  canvas.addEventListener('webglcontextlost',event => {
    event.preventDefault(); cancelAnimationFrame(raf);
    document.documentElement.classList.remove('webgl-ready'); canvas.style.opacity = '0';
  });
  canvas.addEventListener('webglcontextrestored',() => location.reload());
  window.addEventListener('pagehide',() => cancelAnimationFrame(raf));
  window.addEventListener('pageshow',event => {
    if (event.persisted) { lastTime = performance.now(); raf = requestAnimationFrame(frame); }
  });
  raf = requestAnimationFrame(frame);
} catch (error) {
  console.info('Static sculpture is active:',error.message);
  document.documentElement.classList.remove('webgl-ready');
  renderer?.dispose();
}
