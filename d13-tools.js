/* Three.js spatial ratchet/screw tool training control (not haptic collision mechanics).
 * Selected bolt must be fitted with the proper simulated tool. Drag direction and
 * angular travel affect the fastener state. Ratchet and socket are actual 3D meshes. */
(function(root){'use strict';
function create({root:engineRoot,canvas,controls,onTurn}){
 const THREE=root.THREE;
 const socketMat=new THREE.MeshStandardMaterial({color:0x7e8e9b,metalness:.78,roughness:.2});
 const steel=new THREE.MeshStandardMaterial({color:0xe0e6eb,metalness:.82,roughness:.18});
 const grip=new THREE.MeshStandardMaterial({color:0x293b45,metalness:.2,roughness:.67});
 const group=new THREE.Group();group.visible=false; engineRoot.add(group);
 const sleeve=new THREE.Mesh(new THREE.CylinderGeometry(14,14,30,12,1,true),socketMat);sleeve.rotation.x=Math.PI/2;sleeve.position.z=16;group.add(sleeve);
 const shaft=new THREE.Mesh(new THREE.CylinderGeometry(8,8,30,16),steel);shaft.rotation.x=Math.PI/2;shaft.position.z=34;group.add(shaft);
 const head=new THREE.Mesh(new THREE.CylinderGeometry(20,20,15,12),steel);head.rotation.x=Math.PI/2;head.position.z=50;group.add(head);
 const handle=new THREE.Group();handle.position.z=51;group.add(handle);
 const bar=new THREE.Mesh(new THREE.BoxGeometry(145,14,10),steel);bar.position.x=69;handle.add(bar);
 const end=new THREE.Mesh(new THREE.BoxGeometry(55,19,14),grip);end.position.x=133;handle.add(end);
 const dir=new THREE.Mesh(new THREE.ConeGeometry(14,24,3),new THREE.MeshStandardMaterial({color:0xe48e2c,emissive:0x3d1c02}));dir.rotation.z=-Math.PI/2;dir.position.set(160,0,0);handle.add(dir);
 let selected=null,armed=false,down=null,rotation=0,accum=0,tool='socket';
 function detach(){armed=false;group.visible=false;selected=null;down=null;controls.enabled=true;}
 function setTarget(mesh,selectedTool){
   if(!mesh||!mesh.visible||mesh.userData===undefined){detach();return;}
   const same=mesh===selected;if(!same){accum=0;rotation=0;armed=false;}
   selected=mesh;tool=selectedTool||tool;
   const bb=mesh.geometry.boundingBox||(mesh.geometry.computeBoundingBox(),mesh.geometry.boundingBox);
   const pos=new THREE.Vector3(),quat=new THREE.Quaternion(),scale=new THREE.Vector3();mesh.matrix.decompose(pos,quat,scale);
   const axis=new THREE.Vector3(0,0,1).applyQuaternion(quat);
   group.position.copy(pos).addScaledVector(axis,bb.max.z+3);
   group.quaternion.copy(quat);handle.rotation.z=rotation;
   group.visible=armed&&(tool==='socket'||tool==='torque');
 }
 function engage(){if(!selected||!(tool==='socket'||tool==='torque'))return false;armed=!armed;group.visible=armed;return armed;}
 function status(){return{armed,turns:Math.abs(accum)/(2*Math.PI),rotation:rotation%(Math.PI*2)};}
 canvas.addEventListener('pointerdown',e=>{if(!armed||!selected)return;
   down={x:e.clientX,y:e.clientY,id:e.pointerId,last:e.clientX,moved:0};
   controls.enabled=false;
   try{canvas.setPointerCapture(e.pointerId)}catch(_){}
 });
 canvas.addEventListener('pointermove',e=>{if(!down||e.pointerId!==down.id)return;
   const d=e.clientX-down.last;down.last=e.clientX;down.moved+=d;
   rotation+=d*.022;handle.rotation.z=rotation;
 });
 function finish(e){if(!down||e.pointerId!==down.id)return;
   const amount=down.moved*.022;down=null;controls.enabled=true;
   if(Math.abs(amount)>.1){accum+=amount;if(onTurn)onTurn(amount,tool);}
 }
 canvas.addEventListener('pointerup',finish);canvas.addEventListener('pointercancel',e=>{down=null;controls.enabled=true;});
 return{setTarget,engage,detach,status,get armed(){return armed},get selected(){return selected}};
}
root.D13Tools={create};
})(globalThis);
