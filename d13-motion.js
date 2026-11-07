/* Live kinematic animation using ORIGINAL uploaded component meshes and matrices.
   Engine frame X = crank axis, Z = cylinder up, Y = crank throw direction.
   No re-exported or invented replacement piston meshes. */
(function(root){'use strict';
function create(opts){
  const {items,DATA}=opts,P=root.D13Physics;
  const byId=new Map();
  items.forEach(mesh=>{const id=DATA.parts[mesh.userData.pi].id;if(!byId.has(id))byId.set(id,[]);byId.get(id)[mesh.userData.ki]=mesh;});
  const liftable=['ECR-006','ECR-007','ECR-008','ECR-009','ECR-010','ECR-011'];
  const rodParts=['ECR-012','ECR-013','ECR-014','ECR-015'];
  const rotX=new THREE.Matrix4(),rotZ=new THREE.Matrix4(),shift=new THREE.Matrix4(),scale=new THREE.Matrix4();
  const B=()=>new THREE.Matrix4();
  let angle=0, enabled=false, internals=false;
  function each(id,fn){const arr=byId.get(id);if(arr)arr.forEach((m,i)=>{if(m)fn(m,i)});}
  function updateMesh(mesh,m){mesh.matrix.copy(m);mesh.matrixWorldNeedsUpdate=true;}
  function transform(mesh,transY,transZ,rot=0){
    // Model parts carry the same 2.5 degree lean; translation is in engine coordinates.
    const d=shift.makeTranslation(.0436*transZ,transY,.999*transZ);
    const M=B().multiplyMatrices(d,mesh.userData.base);
    if(rot)M.multiply(rotX.makeRotationX(rot));
    updateMesh(mesh,M);
  }
  function apply(angle720){
    if(!enabled)return;
    angle=P.mod(angle720,720);
    each('ECR-001',m=>updateMesh(m,B().copy(m.userData.base).multiply(rotX.makeRotationX(angle*Math.PI/180))));
    // Explicit crank/cam gear speeds and directions for illustrative rigid meshing.
    for(const id of ['ETG-003','ETG-017','ETG-018','ETG-019'])each(id,m=>updateMesh(m,B().copy(m.userData.base).multiply((id==='ETG-003'||id==='ETG-018')?rotZ.makeRotationZ(angle*Math.PI/180):rotX.makeRotationX(angle*Math.PI/180))));
    each('EHD-014',m=>updateMesh(m,B().copy(m.userData.base).multiply(rotX.makeRotationX(angle*Math.PI/360))));
    each('ETG-008',m=>updateMesh(m,B().copy(m.userData.base).multiply(rotZ.makeRotationZ(angle*Math.PI/360))));
    for(let c=0;c<6;c++){
      const initial=P.crankPins[c], phi=P.mod(angle-P.FIRE[c],360);
      const pistonDelta=(P.slider(phi)-P.slider(initial))*1000;
      const b0=P.pin(initial), b=P.pin(phi);
      const dy=(b.y-b0.y)*1000,dz=(b.z-b0.z)*1000;
      const tiltDelta=P.rodTilt(initial)-P.rodTilt(phi);
      for(const id of liftable)each(id,(m,k)=>{if(id==='ECR-011' ? Math.floor(k/2)===c : k===c)transform(m,0,pistonDelta);});
      for(const id of rodParts)each(id,(m,k)=>{if(k===c)transform(m,dy,dz,tiltDelta);});
      const cy=P.mod(angle-P.FIRE[c]+360,720);
      const intake=P.valveLift(cy,'intake'),exhaust=P.valveLift(cy,'exhaust');
      each('EHD-003',(m,k)=>{if(Math.floor(k/2)===c)transform(m,0,-intake);});
      each('EHD-004',(m,k)=>{if(Math.floor(k/2)===c)transform(m,0,-exhaust);});
      // Springs compress about the seat rather than translating as rigid bodies.
      for(const id of ['EHD-009','EHD-011','EHD-012'])each(id,(m,k)=>{
        const cyl=Math.floor((k%12)/2);if(cyl!==c)return;
        const v=k<12?intake:exhaust;
        if(id==='EHD-009'){
          const M=B().copy(m.userData.base).multiply(scale.makeScale(1,1,1-v/65));updateMesh(m,M);
        } else transform(m,0,-v);
      });
      each('EHD-010',(m,k)=>{if(Math.floor(k/2)===c){const M=B().copy(m.userData.base).multiply(scale.makeScale(1,1,1-exhaust/65));updateMesh(m,M)}});
      each('EHD-013',(m,k)=>{if(k%6===c)transform(m,0,-(k<6?intake:exhaust))});
      for(const [id,lift] of [['EHD-019',intake],['EHD-020',exhaust]])each(id,(m,k)=>{if(k===c)updateMesh(m,B().copy(m.userData.base).multiply(rotX.makeRotationX(lift*.008)))});
      each('EHD-021',(m,k)=>{if(k===c)updateMesh(m,B().copy(m.userData.base).multiply(rotX.makeRotationX(P.valveLift(cy,'intake')*.003)))});
    }
  }
  function reset(){enabled=false;for(const id of [...liftable,...rodParts,'ECR-001','EHD-003','EHD-004','EHD-009','EHD-010','EHD-011','EHD-012','EHD-013','EHD-014','EHD-019','EHD-020','EHD-021','ETG-003','ETG-008','ETG-017','ETG-018','ETG-019'])each(id,m=>updateMesh(m,m.userData.base));}
  const hiddenCutaway=new Set(['EBK-001','EHD-001','EHD-029','EHD-028','EBK-008','ETG-014','ETG-015','EBK-002']);
  function shouldHide(mesh){return internals&&hiddenCutaway.has(DATA.parts[mesh.userData.pi].id);}
  function setInternals(v){internals=!!v;}
  function setEnabled(v){if(v){enabled=true;apply(angle)}else reset();}
  return {apply,reset,shouldHide,setInternals,setEnabled,get enabled(){return enabled},get internals(){return internals},get angle(){return angle},getMesh(id,k=0){return byId.get(id)?.[k]}};
}
root.D13Motion={create};
})(globalThis);
