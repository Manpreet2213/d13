/*
 * Volvo D13 mechanical-workshop prototype.
 * Not an OEM procedure, torque manual, measured CAD model or physical simulation.
 * Every fastener instance has its own finite state and the geometry comes from the
 * user-supplied VNL model.  No unverified numeric torque values are invented.
 */
(function () {
  'use strict';
  const STEPS = [
    {name:'Valve-cover fasteners', ids:['EFS-011'], bolt:true, note:'Release all 20 modeled cover fasteners before lifting the cover. The exact OEM count and procedure depend on engine variant.'},
    {name:'Valve cover', ids:['EHD-029'], note:'Lift the cover after every modeled cover fastener is free.'},
    {name:'Valve-cover gasket', ids:['EHD-028'], seal:true, note:'Inspect the sealing surface. A missing or damaged gasket will create an oil-leak fault in the training model.'},
    {name:'Rocker-shaft fasteners', ids:['EFS-008'], bolt:true, note:'Use the selected fastener and tool. Real engines require specific loosening/tightening sequences; the guided dependency here is simplified.'},
    {name:'Rocker arm shaft', ids:['EHD-018'], note:'Modelled as a separate liftable component. In reality the rocker arms and shaft require careful service handling.'},
    {name:'Rocker arms (18)', ids:['EHD-019','EHD-020','EHD-021'], note:'Six inlet, six exhaust and six injector rocker arms are individually removable in this model.'},
    {name:'Cam bearing cap fasteners', ids:['EFS-007'], bolt:true, note:'Release the individual modeled bearing-cap fasteners. This is NOT a verified OEM camshaft removal sequence.'},
    {name:'Camshaft bearing caps', ids:['EHD-016','EHD-017'], note:'Caps must remain identified with their original positions. Avoid interchanging matched bearings/caps in real life.'},
    {name:'Timing cover fasteners', ids:['EFS-017'], bolt:true, note:'The model exposes timing-drive access; the full vehicle access/disconnection procedure is not reproduced.'},
    {name:'Timing gear cover', ids:['ETG-015'], note:'Remove the timing cover to reach the modeled camshaft drive.'},
    {name:'Cam gear fasteners', ids:['EFS-013'], bolt:true, note:'Cam/crank timing must be secured with OEM procedures before gear removal. This training model does not verify mechanical timing.'},
    {name:'Camshaft drive gear', ids:['ETG-008'], note:'Separates the modeled cam gear. Do not use this exercise as real-world cam timing instructions.'},
    {name:'Camshaft', ids:['EHD-014'], note:'Lift the camshaft after the model dependencies are cleared. In the real engine, protect journals and inspect clearances.'},
    {name:'Camshaft bearing shells', ids:['EHD-015'], note:'Seven modeled pairs. Bearings must be checked against the exact engine documentation; sizes here are not guaranteed.'}
  ];
  const TOOLS = [
    {id:'socket', label:'Socket / ratchet', icon:'13'},
    {id:'hand', label:'Hands / lift', icon:'H'},
    {id:'torque', label:'Torque check', icon:'T'}
  ];
  const escapeText = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const hasStorage = (()=>{try{const k='__d13probe'; localStorage.setItem(k,'1');localStorage.removeItem(k);return true;}catch(_){return false;}})();
  window.createD13Workshop = function (x) {
    const $ = (id) => document.getElementById(id);
    const piById = new Map(x.DATA.parts.map((p, i) => [p.id, i]));
    const instanceMeshes = new Map();
    x.items.forEach(m => {const id=x.DATA.parts[m.userData.pi].id;
      if (!instanceMeshes.has(id)) instanceMeshes.set(id, []);
      instanceMeshes.get(id)[m.userData.ki] = m;
    });
    const valid = STEPS.every(s=>s.ids.every(id=>piById.has(id)));
    if (!valid) {console.warn('Workshop unavailable: engine dataset missing parts'); return {active:false, tick(){}, isVisible(){return true}, onSelect(){}};}
    const storeKey='vnl-d13-lab-v2-' + (window.location.pathname.endsWith('d13.html') ? 'engine':'full');
    const states = new Map();
    STEPS.forEach(step=>step.ids.forEach(id=>{
      const p=x.DATA.parts[piById.get(id)];
      states.set(id, Array.from({length:p.inst.length},()=>step.bolt?'tight':'installed'));
    }));
    let saved = null;
    if (hasStorage) {try {saved=JSON.parse(localStorage.getItem(storeKey)||'null');} catch (_) {}}
    if (saved && saved.states) for (const [id,arr] of Object.entries(saved.states)) {
      if (states.has(id) && Array.isArray(arr) && arr.length === states.get(id).length) {
        const bolt=STEPS.find(s=>s.ids.includes(id)).bolt;
        const allowed=bolt?['tight','loose','out']:['installed','out'];
        if(arr.every(v=>allowed.includes(v))) states.set(id,arr.slice());
      }
    }
    let active=false, phase='remove', practice=false, tool='socket', chosen=null, gasketGood=true;
    let running=false, oil=100, temp=55, rpm=0, seconds=0, message='', messageType='', log=[];
    const physics = new window.D13Physics.Engine();
    const motion = window.D13Motion.create(x);
    const effects = window.D13Effects.create(x);
    let cutaway=false, slowMotion=true, crankAngle=0, pressureCylinder=1, turnTravel=0;
    let wrench = null;
    let showBench=false, showcase=false, pendingFocus=false, animations=new Map(), previous=performance.now();
    if(saved){phase=saved.phase==='install'?'install':'remove';practice=!!saved.practice;gasketGood=saved.gasketGood!==false;oil=Number.isFinite(saved.oil)?Math.max(0,Math.min(100,saved.oil)):100;}
    physics.setOil(oil);
    wrench=window.D13Tools.create({root:x.root,canvas:x.canvas,controls:x.controls,onTurn:onToolTurn});
    const hud=document.createElement('div');hud.id='lab-hud';hud.className='lab-hud';hud.hidden=true;x.canvas.parentElement.appendChild(hud);
    const panel=$('d13-panel');
    const btnWorkshop=$('mode-lab'),btnCatalog=$('mode-catalog');
    const byId=id=>x.DATA.parts[piById.get(id)];
    const getState=(id,k)=>states.get(id)?.[k];
    const isOut=(id,k)=>getState(id,k)==='out';
    const allStates=step=>step.ids.flatMap(id=>states.get(id));
    const completed=step=>allStates(step).every(v=>phase==='remove'?v==='out':(step.bolt?v==='tight':v==='installed'));
    const currentIndex=()=>{
      const order=phase==='remove'?STEPS:STEPS.slice().reverse();
      const step=order.find(s=>!completed(s));
      return step?STEPS.indexOf(step):-1;
    };
    const totalCount=()=>STEPS.reduce((n,s)=>n+s.ids.reduce((a,id)=>a+states.get(id).length,0),0);
    const doneCount=()=>STEPS.reduce((n,s)=>n+s.ids.reduce((a,id)=>a+states.get(id).filter(v=>phase==='remove'?v==='out':(s.bolt?v==='tight':v==='installed')).length,0),0);
    const save=()=>{if(!hasStorage)return;try{localStorage.setItem(storeKey,JSON.stringify({phase,practice,gasketGood,oil,states:Object.fromEntries(states)}));}catch(_){}};
    function note(text,type=''){message=text;messageType=type;if(type==='critical'||type==='good')addLog(text);render();}
    function addLog(msg){const t=new Date().toLocaleTimeString();log.unshift(`${t} ${msg}`);log=log.slice(0,40);}
    function stageParts(step){return step.ids.flatMap(id=>(instanceMeshes.get(id)||[]).filter(Boolean));}
    function focusOn(meshes, minimumSize=1150) {
      if (!meshes.length)return;
      x.root.updateMatrixWorld(true);
      const box=new THREE.Box3(); meshes.forEach(m=>box.expandByObject(m));
      if(box.isEmpty())return;
      const center=box.getCenter(new THREE.Vector3());
      const size=Math.max(minimumSize, box.getSize(new THREE.Vector3()).length);
      x.camera.position.set(center.x-size*.52,center.y+size*.42,center.z-size*.55);
      x.controls.target.copy(center); x.controls.update();
      x.camera.near=5; x.camera.updateProjectionMatrix();
    }
    function focusEngine() {
      focusOn(x.items.filter(m=>x.DATA.parts[m.userData.pi].s.startsWith('E') && !isOut(x.DATA.parts[m.userData.pi].id,m.userData.ki)),3700);
    }
    function focusStage(){const si=currentIndex();if(si>=0)focusOn(stageParts(STEPS[si]).filter(m=>!isOut(x.DATA.parts[m.userData.pi].id,m.userData.ki)),1400); else focusEngine();}
    function recommendedTool(step){
      if(!step)return'hand';
      if(!step.bolt)return'hand';
      if(phase==='remove')return'socket';
      return step.ids.some(id=>states.get(id).some(v=>v==='loose'))?'torque':'hand';
    }
    function pickTarget(step){
      if (!step)return null;
      const candid=[];
      for(const id of step.ids)for(let k=0;k<states.get(id).length;k++){
        const s=getState(id,k),done=phase==='remove'?s==='out':(step.bolt?s==='tight':s==='installed');
        if(!done)candid.push({id,k,s});
      }
      if(!candid.length)return null;
      if(chosen && step.ids.includes(chosen.id)) {
        const exact=candid.find(v=>v.id===chosen.id && v.k===chosen.k);
        if(exact)return exact;
      }
      // Complete one loosening/tightening cycle at a time in guided work.
      if(step.bolt){const priority=phase==='remove'?'loose':'loose';return candid.find(v=>v.s===priority)||candid[0];}
      return candid[0];
    }
    function stateAction(step,target){
      if(!step||!target)return null;
      if(step.bolt) {
        if(phase==='remove')return target.s==='tight'?{tool:'socket',verb:'Loosen',result:'loose'}:{tool:'socket',verb:'Extract',result:'out'};
        return target.s==='out'?{tool:'hand',verb:'Start by hand',result:'loose'}:{tool:'torque',verb:'Verify simulated torque',result:'tight'};
      }
      return phase==='remove'?{tool:'hand',verb:'Lift',result:'out'}:{tool:'hand',verb:'Install',result:'installed'};
    }
    function animateMesh(id,k,outgoing){const mesh=instanceMeshes.get(id)?.[k];if(!mesh)return;animations.set(mesh,{at:performance.now(),duration:650,outgoing});}
    function mutate(id,k,next){states.get(id)[k]=next;turnTravel=0;wrench.detach();animateMesh(id,k,next==='out');save();applyMeshVis();}
    function applyMeshVis(){x.applyVis();}
    function onToolTurn(delta,usedTool){
      if(running){note('Stop the engine before using the 3D ratchet.','critical');return;}
      if(!chosen||!states.has(chosen.id)){note('Select a visible bolt in the 3D engine first.');return;}
      const step=STEPS.find(s=>s.ids.includes(chosen.id));
      if(!step||!step.bolt){note('This component cannot accept the ratchet.');return;}
      const si=currentIndex();
      if(!practice && step!==STEPS[si]){note('This fastener is not available yet in the guided sequence.','critical');return;}
      const act=stateAction(step,{...chosen,s:getState(chosen.id,chosen.k)});
      if(!act||act.tool!==usedTool){note('Selected tool does not fit the required action.','critical');return;}
      const wanted=phase==='remove'?-1:1;
      if(Math.sign(delta)!==wanted){note(wanted===-1?'Turn anticlockwise (drag left) to loosen.':'Turn clockwise (drag right) to fasten.','critical');return;}
      turnTravel+=Math.abs(delta);
      const threshold=act.result==='out'?Math.PI*3.5:act.result==='loose'?Math.PI*.7:Math.PI*.45;
      if(turnTravel>=threshold){turnTravel=0;perform(false);}
      else{message=`Ratchet engaged: ${(100*turnTravel/threshold).toFixed(0)}% of training angular travel. Keep turning ${wanted===-1?'left':'right'}.`;messageType='';render();}
    }
    function syncWrench(){
      const candidate=chosen&&states.has(chosen.id)?chosen:null;
      const m=candidate?instanceMeshes.get(candidate.id)?.[candidate.k]:null;
      const isBolt=candidate&&STEPS.some(s=>s.bolt&&s.ids.includes(candidate.id));
      wrench.setTarget(isBolt&&getState(candidate.id,candidate.k)!=='out'?m:null,tool);
    }
    function perform(auto=false) {
      if(running){note('Stop the engine test before working on the engine.','critical');return;}
      const si=currentIndex();const step=(practice&&chosen?STEPS.find(s=>s.ids.includes(chosen.id)):null)||(si>=0?STEPS[si]:null);if(!step){note('All steps in this phase are complete. Switch to the other phase.','good');return;}
      const target=pickTarget(step), act=stateAction(step,target);
      if(!target||!act)return;
      if(!auto&&tool!==act.tool){note(`Incorrect tool. Use ${TOOLS.find(t=>t.id===act.tool).label.toLowerCase()} for this action.`,'critical');return;}
      if(phase==='remove' && step.ids.includes('EHD-028')) gasketGood=false; // An old removed seal cannot be assumed reusable.
      mutate(target.id,target.k,act.result);
      const p=byId(target.id), completedStage=completed(step);
      chosen=completedStage?null:{id:target.id,k:target.k};
      if(completedStage)addLog(`Stage finished: ${step.name}.`);
      note(`${act.verb}: ${p.n} • instance ${target.k+1}/${states.get(target.id).length}.${completedStage?' Stage complete.':''}`, completedStage?'good':'');
    }
    function assistedStage(){
      if(running){note('Stop the engine before repair.','critical');return;}
      const si=currentIndex();if(si<0)return;
      const step=STEPS[si];
      for(const id of step.ids)states.get(id).forEach((v,k)=>{if(phase==='remove'?v!=='out':v!==(step.bolt?'tight':'installed')){
        states.get(id)[k]=phase==='remove'?'out':(step.bolt?'tight':'installed');
      }});
      if(phase==='remove' && step.seal)gasketGood=false;
      chosen=null;save();applyMeshVis();note(`Instructor assist: completed ${step.name}. (Skipped tool-by-tool operations.)`,'good');
    }
    function togglePhase(next){if(running){note('Stop the engine test first.','critical');return;}phase=next;chosen=null;turnTravel=0;wrench.detach();tool=recommendedTool(STEPS[currentIndex()]);save();render();}
    function diagnosticSummary(){
      const miss=(id)=>states.has(id)&&states.get(id).some(v=>v==='out');
      const loose=(id)=>states.has(id)&&states.get(id).some(v=>v!=='tight');
      const gasketMissing=miss('EHD-028'), coverMissing=miss('EHD-029');
      const critical=[];const faults=[];
      if(miss('EHD-014')||miss('ETG-008'))critical.push('Camshaft or drive gear not installed; engine cannot run.');
      if(miss('EHD-018')||miss('EHD-016')||miss('EHD-017')||miss('EHD-019')||miss('EHD-020')||miss('EHD-021'))critical.push('Valvetrain incomplete; crank/start inhibited.');
      if(miss('EFS-007')||miss('EFS-013')||miss('EFS-008'))critical.push('Critical valvetrain or timing fastener absent; start inhibited.');
      if(coverMissing)faults.push('Valve cover removed: severe oil escape / open engine.');
      if(gasketMissing)faults.push('Cover gasket missing: oil seepage under running conditions.');
      if(!gasketMissing&&!gasketGood)faults.push('Damaged or reused gasket: oil seepage risk.');
      if(loose('EFS-011')&&!coverMissing)faults.push('Cover fasteners loose or missing: sealing fault.');
      if(loose('EFS-017'))faults.push('Timing cover fasteners loose: possible cover leak.');
      if(miss('ETG-015'))faults.push('Timing cover missing: open timing area.');
      return {critical,faults,leak:coverMissing?0.09:(gasketMissing?0.035:(!gasketGood?0.018:0))+(loose('EFS-011')?0.014:0)+(miss('ETG-015')?0.02:0)};
    }
    function startStop(){
      if(running){running=false;physics.stop();rpm=0;addLog('Physical model stopped by operator.');note('Engine model stopped.');return;}
      const d=diagnosticSummary();
      if(d.critical.length){note('START INHIBITED: '+d.critical.join(' '),'critical');return;}
      if(physics.oilLevel<10){note('START INHIBITED: oil level too low.','critical');return;}
      physics.setFault('gasket',d.faults.some(s=>/gasket|sealing|oil seepage|cover/i.test(s)));
      physics.setFault('looseBolts',d.faults.some(s=>/fasteners loose|timing cover fasteners/i.test(s)));
      if(!physics.start()){note('Model cannot start with current oil/damage condition.','critical');return;}
      running=true;rpm=physics.rpm;
      addLog('Zero-dimensional combustion, lubricating oil and thermal model started.');
      if(d.faults.length)addLog('Assembly faults: '+d.faults.join(' | '));
      note(d.faults.length?'Engine model started with assembly faults.':'Engine model started; inspect live cylinder pressure and oil pressure.');
    }
    let frameRenderLast=0, frameVisLast=0;
    function tick(){
      const now=performance.now(),dt=Math.min(.08,Math.max(0,(now-previous)/1000));previous=now;
      let animationFinished=false;
      if(animations.size){for(const [m,a] of animations){const t=Math.min(1,(now-a.at)/a.duration);
        const lift=a.outgoing?t:1-t;
        const M=m.userData.base.clone();M.elements[14]+=lift*360;
        m.matrix.copy(M);m.matrixWorldNeedsUpdate=true;
        if(t>=1){animations.delete(m);m.matrix.copy(m.userData.base);m.matrixWorldNeedsUpdate=true;animationFinished=true;}
      }if(animationFinished)x.applyVis();}
      if(running){
        const d=diagnosticSummary();
        physics.setFault('gasket',d.faults.some(s=>/gasket|sealing|oil seepage|cover/i.test(s)));
        physics.setFault('looseBolts',d.faults.some(s=>/fasteners loose|timing cover fasteners/i.test(s)));
        // High-speed solving uses small substeps, even if rendering is 30-60 fps.
        let remaining=dt*(slowMotion?.025:1);
        while(remaining>0){const step=Math.min(remaining,1/180);physics.tick(step);remaining-=step;}
        rpm=physics.rpm;temp=physics.coolant;oil=physics.oilLevel;seconds=physics.seconds;
        if(!physics.running){running=false;const why=physics.alerts.join(' ')||'Model stalled';addLog('ENGINE SHUTDOWN: '+why);message='Engine stopped: '+why;messageType='critical';render();}
        if(Math.floor(seconds)%60===0&&Math.floor(seconds)!==Math.floor(seconds-dt))save();
      }
      if(active){
        if(motion.enabled){
          const a=running?physics.angle:crankAngle;
          // Skip fastener extraction meshes; kinematic moving components are separate.
          motion.apply(a);
          effects.update(physics,dt);
        }
        if(now-frameRenderLast>140){frameRenderLast=now;renderMeters();}
      }
    }
    function isVisible(mesh){
      const id=x.DATA.parts[mesh.userData.pi].id; if(active && !x.DATA.parts[mesh.userData.pi].s.startsWith('E'))return false;
      if(active&&motion.shouldHide(mesh))return false;
      if(!states.has(id))return true;
      const s=getState(id,mesh.userData.ki);
      if(s!=='out')return true;
      const anim=animations.get(mesh);
      if(anim)return true;
      return false;
    }
    function onSelect(pi,k){if(!active)return;const id=x.DATA.parts[pi]?.id;
      chosen=states.has(id)?{id,k:typeof k==='number'?k:0}:null;
      syncWrench();render();
    }
    function enable(flag){
      active=flag;document.querySelector('.app').classList.toggle('lab-active',flag);
      panel.hidden=!flag;hud.hidden=!flag;
      btnWorkshop.setAttribute('aria-pressed',String(flag));btnCatalog.setAttribute('aria-pressed',String(!flag));
      $('ex').value=0;$('ex').disabled=flag;
      x.items.forEach(m=>m.matrix.copy(m.userData.base));
      x.applyVis();
      if(flag){motion.setEnabled(true);motion.apply(crankAngle);effects.enable(cutaway);focusEngine();render();}
      else{if(running){physics.stop();running=false;}motion.reset();effects.enable(false);wrench.detach();x.home();$('card').hidden=true;}
    }
    function drawPressureGraph(){
      const can=$('lab-pressure-graph');if(!can||!can.getContext)return;
      const ctx=can.getContext('2d');if(!ctx)return;
      const W=can.width,H=can.height;ctx.clearRect(0,0,W,H);
      const isDark=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;
      const ink=isDark?'#bfcad2':'#516575',grid=isDark?'#3c4851':'#e6eaed';
      ctx.font='10px system-ui';ctx.lineWidth=1;ctx.fillStyle=ink;ctx.strokeStyle=grid;
      const plotX=32,plotY=10,plotW=W-42,plotH=H-30;
      for(let k=0;k<=4;k++){const y=plotY+plotH*k/4;ctx.beginPath();ctx.moveTo(plotX,y);ctx.lineTo(plotX+plotW,y);ctx.stroke();ctx.fillText(String((4-k)*50),2,y+3);}
      let maxPressure=200;ctx.strokeStyle='#da753d';ctx.lineWidth=2;ctx.beginPath();
      for(let a=0;a<=720;a+=4){
        const cycleNow=physics.cycle(pressureCylinder-1);
        const at=physics.angle+(a-cycleNow);
        const bar=physics.pressure(pressureCylinder-1,at)/1e5;
        const px=plotX+a/720*plotW,py=plotY+plotH*(1-Math.min(maxPressure,bar)/maxPressure);
        if(!a)ctx.moveTo(px,py);else ctx.lineTo(px,py);
      }
      ctx.stroke();
      const marker=plotX+physics.cycle(pressureCylinder-1)/720*plotW;
      ctx.strokeStyle='#44a1ca';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(marker,plotY);ctx.lineTo(marker,plotY+plotH);ctx.stroke();
      ctx.fillStyle=ink;ctx.fillText('0°',plotX, H-4);ctx.fillText('360° / fire',plotX+plotW*.46,H-4);ctx.fillText('720°',W-42,H-4);
    }
    function renderMeters(){if(!active)return;
      const l=$('lab-oil-label'),m=$('lab-oil-meter'),h=$('lab-heat-label'),status=$('lab-test-status');
      if(!l||!m)return;
      l.textContent=physics.oilLevel.toFixed(1)+'%';m.style.width=physics.oilLevel.toFixed(1)+'%';
      m.parentElement.className='lab-meter'+(physics.oilLevel<25?' danger':physics.oilLevel<60?' warning':'');
      h.textContent=physics.coolant.toFixed(1)+'°C';
      status.textContent=running?`${Math.round(physics.rpm)} RPM · ${physics.seconds.toFixed(1)} model sec`:'Stopped · crank '+Math.round(crankAngle)+'°';
      const t=$('lab-test-toggle');if(t)t.textContent=running?'Stop engine test':'Start engine test';
      const msg=$('lab-message');if(msg){msg.textContent=message||'Select a component in the model or operate the next workbench item.';msg.className='lab-message '+messageType;}
      const sum=$('lab-test-faults');if(sum){const r=diagnosticSummary();sum.textContent=r.critical.length?r.critical.join(' '):[...r.faults,...physics.alerts].join(' · ')||'No modeled faults detected.';}
      const figures={ 'lab-oil-psi':`${Math.round(physics.oilPressure)} kPa`, 'lab-boost':`${physics.boostKpa.toFixed(0)} kPa abs`, 'lab-power':`${Math.round(physics.torque)} N·m`, 'lab-damage':`${physics.damage.toFixed(1)}%`, 'lab-fuel':`${physics.fuelGps.toFixed(1)} g/s`, 'lab-oil-heat':`${Math.round(physics.oilTemp)}°C`, 'lab-oil-flow':`${physics.oilFlowLpm.toFixed(1)} L/min`, 'lab-cool-flow':`${physics.coolantFlowLpm.toFixed(1)} L/min`, 'lab-cool-pressure':`${Math.round(physics.coolantPressureKpa)} kPa`, 'lab-cool-level':`${physics.coolantLevel.toFixed(1)}%`, 'lab-thermostat':`${Math.round(physics.thermostatOpen*100)}% open` };
      Object.entries(figures).forEach(([id,value])=>{const el=$(id);if(el)el.textContent=value});
      const cycles=$('lab-cycles');if(cycles)cycles.innerHTML=physics.cylinders().map(c=>`<span class="lab-cycle"><b>${c.number}</b> ${c.stroke} <small>${c.pressureBar.toFixed(0)} bar · ${Math.max(c.inletLiftMm,c.exhaustLiftMm).toFixed(1)} mm lift</small></span>`).join('');
      drawPressureGraph();
    }
    function render(){if(!active)return;
      const retainedScroll=panel.scrollTop;
      const si=currentIndex(),guidedStep=si>=0?STEPS[si]:null,step=(practice && chosen ? STEPS.find(s=>s.ids.includes(chosen.id))||guidedStep : guidedStep),target=pickTarget(step), act=stateAction(step,target);
      const count=totalCount(),done=doneCount(),pct=Math.round(100*done/count);
      const reversed=phase==='remove'?STEPS:STEPS.slice().reverse();
      const stepList=reversed.map((s,i)=>{
        const n=s.ids.reduce((a,id)=>a+states.get(id).length,0);
        const d=s.ids.reduce((a,id)=>a+states.get(id).filter(v=>phase==='remove'?v==='out':(s.bolt?v==='tight':v==='installed')).length,0);
        const c=completed(s),cur=s===step, future=!c&&!cur;
        return `<button class="lab-step ${c?'complete':''} ${future?'future':''}" data-focus="${STEPS.indexOf(s)}" ${cur?'aria-current="step"':''}>
           <span class="step-num">${c?'✓':String(i+1).padStart(2,'0')}</span><span class="step-name">${escapeText(s.name)}</span>
           <span class="step-count">${d}/${n}</span></button>`;
      }).join('');
      const nextTool=act?TOOLS.find(t=>t.id===act.tool):null;
      const selectedLabel=chosen && states.has(chosen.id)?`${byId(chosen.id).n} #${chosen.k+1} · ${getState(chosen.id,chosen.k)}`: 'No specific instance selected; next outstanding item used';
      const targetLabel=target?`${byId(target.id).n} #${target.k+1} (${target.s})`: 'All components complete';
      panel.innerHTML=`
       <div class="lab-head"><h2>D13 Workshop</h2><span class="lab-chip warn">TRAINING MODEL</span></div>
       <div class="lab-muted">Individual parts and fasteners are tracked separately. Model geometry and service data have not been OEM verified.</div>
       <div class="lab-note">Learning exercise only — not an actual Volvo repair or timing procedure. Never apply unverified bolt counts, torque values, clearances or disassembly order to a real engine.</div>
       <div class="lab-switches"><button class="lab-pill" data-phase="remove" aria-pressed="${phase==='remove'}">Disassemble</button><button class="lab-pill" data-phase="install" aria-pressed="${phase==='install'}">Reassemble</button><button class="lab-pill" id="lab-focus-engine">Frame engine</button><button class="lab-pill" id="lab-practice" aria-pressed="${practice}">${practice?'Experiment: ON':'Experiment: OFF'}</button></div>
       <div class="lab-mini"><span>${phase==='remove'?'Parts removed':'Parts correctly refitted'}</span><output>${done}/${count} · ${pct}%</output></div>
       <div class="lab-progress"><div style="width:${pct}%"></div></div>
       <div class="lab-section"><h3>${step?'Next operation':'Sequence complete'}</h3>
        <strong style="font-size:13px;line-height:1.3;display:block">${step?escapeText(step.name):'All steps finished'}</strong>
        <p class="lab-muted">${step?escapeText(step.note):'Switch phase to reassemble or disassemble the engine again.'}</p>
        <div class="lab-muted">3D selection: ${escapeText(selectedLabel)}</div>
        <div class="lab-muted" style="margin-top:4px">Target: ${escapeText(targetLabel)}</div>
        <div class="lab-tool-row">${TOOLS.map(t=>`<button data-tool="${t.id}" aria-pressed="${tool===t.id}"><span class="tool-symbol">${t.icon}</span>${escapeText(t.label)}</button>`).join('')}</div>
        <button id="lab-wrench" class="lab-pill" ${chosen&&STEPS.some(s=>s.bolt&&s.ids.includes(chosen.id))?'':'disabled'} aria-pressed="${wrench.armed}">${wrench.armed?'Ratchet placed — drag on engine':'Place 3D ratchet on selected bolt'}</button>
        <p class="lab-muted">For spatial tool practice, tap an actual bolt in the 3D engine, select the needed tool, place the ratchet, then drag LEFT to loosen or RIGHT to tighten. Turn repeatedly; partial turns persist. Hardware torque values are not OEM calibrated.</p>
        <button id="lab-do" class="lab-primary" ${step?'':'disabled'}>${act?escapeText(act.verb)+' selected / next part':'Phase completed'}</button>
        <div class="lab-mini"><span>Suggested tool</span><output>${nextTool?escapeText(nextTool.label):'—'}</output></div>
        <div class="lab-grid"><button class="lab-pill" id="lab-focus">Focus current step</button><button class="lab-pill" id="lab-assist" ${step?'':'disabled'}>Instructor assist: stage</button></div>
        <div id="lab-message" class="lab-message ${messageType}">${escapeText(message||'Tap a component in 3D to target an instance. Or use Next operation.')}</div>
       </div>
       <div class="lab-section"><h3>Workbench stages</h3>${stepList}</div>
       <div class="lab-section"><h3>Fault experiments</h3>
         <div class="lab-muted">A gasket removed during teardown is marked as not service-ready. Replacing it restores the training-model seal. You may intentionally leave parts missing and check simulated consequences.</div>
         <div class="lab-mini"><span>Cover gasket condition</span><output>${gasketGood?'Service-ready':'Damaged / removed'}</output></div>
         <div class="lab-grid"><button id="lab-replace" class="lab-pill">Fit new gasket condition</button><button id="lab-damage" class="lab-pill">Inject gasket fault</button></div>
         <p class="lab-compact-note">Fault logic is simplified and illustrative. No OEM oil consumption or damage rates are claimed.</p>
       </div>
       <div class="lab-section"><h3>Engine condition test</h3>
         <div class="lab-mini"><span>Oil condition (model scale)</span><output id="lab-oil-label"></output></div><div class="lab-meter"><span id="lab-oil-meter"></span></div>
         <div class="lab-mini"><span>Indicated temperature</span><output id="lab-heat-label"></output></div>
         <div class="lab-mini"><span>Run status</span><output id="lab-test-status"></output></div>
         <div class="lab-mini"><span>Calculated oil gallery pressure</span><output id="lab-oil-psi"></output></div>
         <div class="lab-mini"><span>Oil temperature</span><output id="lab-oil-heat"></output></div>
         <div class="lab-mini"><span>Oil flow (calculated)</span><output id="lab-oil-flow"></output></div>
         <div class="lab-mini"><span>Coolant flow (calculated)</span><output id="lab-cool-flow"></output></div>
         <div class="lab-mini"><span>Coolant pressure (calculated)</span><output id="lab-cool-pressure"></output></div>
         <div class="lab-mini"><span>Coolant inventory</span><output id="lab-cool-level"></output></div>
         <div class="lab-mini"><span>Thermostat model</span><output id="lab-thermostat"></output></div>
         <div class="lab-mini"><span>Intake manifold pressure</span><output id="lab-boost"></output></div>
         <div class="lab-mini"><span>Crankshaft torque (illustrative)</span><output id="lab-power"></output></div>
         <div class="lab-mini"><span>Fuel flow</span><output id="lab-fuel"></output></div>
         <div class="lab-mini"><span>Accumulated damage</span><output id="lab-damage"></output></div>
         <div class="lab-slider"><label>Throttle <output id="lab-throttle-v">${physics.throttle}%</output></label><input id="lab-throttle" type="range" min="0" max="100" value="${physics.throttle}"></div>
         <div class="lab-slider"><label>External load <output id="lab-load-v">${physics.load}%</output></label><input id="lab-load" type="range" min="0" max="100" value="${physics.load}"></div>
         <div class="lab-grid" style="margin-top:6px"><button class="lab-pill" id="lab-slow" aria-pressed="${slowMotion}">${slowMotion?'Slow motion 0.025×':'Normal time 1×'}</button><button class="lab-pill" id="lab-cutaway" aria-pressed="${cutaway}">${cutaway?'Internals visible':'Hide block / head'}</button></div>
         <div class="lab-slider"><label>Hand-crank angle <output id="lab-crank-v">${Math.round(crankAngle)}°</output></label><input id="lab-crank" type="range" min="0" max="720" value="${Math.round(crankAngle)}" ${running?'disabled':''}></div>
         <div class="lab-grid"><button class="lab-pill" id="lab-crank-minus" ${running?'disabled':''}>− 15°</button><button class="lab-pill" id="lab-crank-plus" ${running?'disabled':''}>+ 15°</button></div>
         <div class="lab-mini"><label>Pressure trace · cylinder <select id="lab-cylinder">${[1,2,3,4,5,6].map(i=>`<option ${i===pressureCylinder?'selected':''}>${i}</option>`).join('')}</select></label><span>bar versus 720°</span></div>
         <canvas id="lab-pressure-graph" width="336" height="154" aria-label="Computed cylinder pressure versus four-stroke crank angle"></canvas>
         <div class="lab-cycles" id="lab-cycles"></div>
         <button id="lab-test-toggle" class="lab-primary secondary">Start engine test</button>
         <div class="lab-message" id="lab-test-faults"></div>
         <div class="lab-grid" style="margin-top:6px"><button class="lab-pill" id="lab-oil-reset">Restore oil condition</button><button class="lab-pill" id="lab-reset">Reset complete lab</button></div>
         <div class="lab-section"><h3>Fluid-circuit faults</h3>
          <div class="lab-grid"><button class="lab-pill" data-fault="waterPump" aria-pressed="${physics.faults.waterPump}">Coolant pump failure</button><button class="lab-pill" data-fault="radiator" aria-pressed="${physics.faults.radiator}">Blocked radiator</button><button class="lab-pill" data-fault="oilPump" aria-pressed="${physics.faults.oilPump}">Oil pump failure</button><button class="lab-pill" data-fault="airFilter" aria-pressed="${physics.faults.airFilter}">Air inlet restriction</button><button class="lab-pill" data-fault="injector" aria-pressed="${physics.faults.injector}">Cylinder 3 injector fault</button><button class="lab-pill" data-fault="lowOil" aria-pressed="${physics.faults.lowOil}">External oil leak</button><button class="lab-pill" data-fault="coolantLeak" aria-pressed="${physics.faults.coolantLeak}">Coolant hose leak</button><button class="lab-pill" data-fault="thermostatStuck" aria-pressed="${physics.faults.thermostatStuck}">Thermostat stuck shut</button></div>
         </div>
         <p class="lab-compact-note">Physics uses a 0-D pressure / volume cycle (Wiebe-inspired fuel burn), rigid crank-slider kinematics, simplified oil flow/viscosity and lumped coolant / radiator heat balance. NOT CFD, a validated D13 performance map, or OEM repair data. The oil/coolant particle paths and combustion glow in cutaway mode are schematic, NOT OEM passages. Engine-time slow motion changes simulated time, too.</p>
       </div>
       <div class="lab-section"><h3>Service log</h3><div class="lab-log">${log.length?log.map(v=>`<div class="line">${escapeText(v)}</div>`).join(''):'<span class="lab-muted">No actions recorded this session.</span>'}</div></div>`;
      hud.innerHTML=`<strong>${step?'D13 · '+escapeText(step.name):'D13 · Sequence complete'}</strong><span>${phase==='remove'?'Teardown':'Reassembly'} ${pct}% · ${escapeText(message||'Select a component or use the workbench')}</span>`;
      panel.querySelectorAll('[data-phase]').forEach(b=>b.onclick=()=>togglePhase(b.dataset.phase));
      panel.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{tool=b.dataset.tool;syncWrench();render();});
      panel.querySelectorAll('[data-focus]').forEach(b=>b.onclick=()=>{
        const s=STEPS[Number(b.dataset.focus)]; if(s)focusOn(stageParts(s),1700);
        if(s!==step)note('Viewed stage: '+s.name+'. Guided operations still follow the active dependency order.');
      });
      $('lab-focus-engine').onclick=focusEngine;
      $('lab-practice').onclick=()=>{practice=!practice;save();note(practice?'Experiment mode allows operations on any selected part. This deliberately bypasses service-order safeguards.':'Guided dependency order restored.');};
      $('lab-focus').onclick=focusStage;
      $('lab-do').onclick=()=>perform(false);
      $('lab-assist').onclick=assistedStage;
      $('lab-wrench').onclick=()=>{if(!wrench.selected)syncWrench();if(wrench.engage()){note('3D ratchet seated on the selected fastener. Drag across the engine viewport to turn.');}else{note('Select a visible bolt first and use socket or torque tool.');}};
      $('lab-throttle').oninput=e=>{physics.throttle=Number(e.target.value);$('lab-throttle-v').textContent=physics.throttle+'%'};
      $('lab-load').oninput=e=>{physics.load=Number(e.target.value);$('lab-load-v').textContent=physics.load+'%'};
      $('lab-slow').onclick=()=>{slowMotion=!slowMotion;render()};
      $('lab-cutaway').onclick=()=>{cutaway=!cutaway;motion.setInternals(cutaway);effects.enable(cutaway);x.applyVis();render()};
      const crankTo=v=>{if(running)return;crankAngle=(Number(v)+720)%720;physics.angle=crankAngle;motion.apply(crankAngle);renderMeters();$('lab-crank-v').textContent=Math.round(crankAngle)+'°'};
      $('lab-crank').oninput=e=>crankTo(e.target.value);
      $('lab-crank-minus').onclick=()=>{crankTo(crankAngle-15);render()};
      $('lab-crank-plus').onclick=()=>{crankTo(crankAngle+15);render()};
      $('lab-cylinder').onchange=e=>{pressureCylinder=Number(e.target.value);drawPressureGraph()};
      panel.querySelectorAll('[data-fault]').forEach(b=>b.onclick=()=>{physics.setFault(b.dataset.fault,!physics.faults[b.dataset.fault]);note((physics.faults[b.dataset.fault]?'Injected fault: ':'Restored: ')+b.textContent);});
      $('lab-test-toggle').onclick=startStop;
      $('lab-replace').onclick=()=>{gasketGood=true;save();note('New gasket condition recorded. The physical gasket still has to be installed.','good');};
      $('lab-damage').onclick=()=>{gasketGood=false;save();note('Fault injected: cover gasket seal marked damaged.','critical');};
      $('lab-oil-reset').onclick=()=>{if(running){note('Stop the engine test first.','critical');return;}oil=100;temp=55;seconds=0;physics.setOil(100);save();note('Model oil condition restored.');};
      $('lab-reset').onclick=()=>{
        if(!window.confirm('Reset all D13 component and fastener positions, gasket condition and oil state?'))return;
        running=false;rpm=0;phase='remove';chosen=null;tool='socket';gasketGood=true;oil=100;temp=55;seconds=0;log=[];animations.clear();wrench.detach();physics.reset();crankAngle=0;cutaway=false;motion.setInternals(false);effects.enable(false);
        STEPS.forEach(s=>s.ids.forEach(id=>states.set(id,states.get(id).map(()=>s.bolt?'tight':'installed'))));
        save(); x.items.forEach(m=>m.matrix.copy(m.userData.base));applyMeshVis();note('Workshop reset to assembled condition.','good');focusEngine();
      };
      syncWrench();panel.scrollTop=retainedScroll;
      renderMeters();
    }
    btnWorkshop.addEventListener('click',()=>enable(true));
    btnCatalog.addEventListener('click',()=>enable(false));
    if(window.location.pathname.endsWith('d13.html') || /D13_Workshop_Phone\.html$/i.test(window.location.pathname))enable(true);
    else if(location.search.includes('workshop=1'))enable(true);
    return {get active(){return active},isVisible,onSelect,tick,enable};
  };
})();
