/* Schematic flow tracers and pressure heat blooms OVER the supplied D13 mesh.
 * Highlighted polylines are educational illustrations — explicitly NOT a mapped
 * Volvo oil gallery, coolant jacket, fuel rail, or a CFD solution. */
(function(root){'use strict';
function create({root:engineRoot}){
 const T=root.THREE,layer=new T.Group();engineRoot.add(layer);
 let on=false,elapsed=0,heat=[];
 const glows=[];
 const sphere=new T.SphereGeometry(1,12,10);
 for(let i=0;i<6;i++){
   const mat=new T.MeshBasicMaterial({color:0xffa344,transparent:true,opacity:.01,depthWrite:false});
   const mesh=new T.Mesh(sphere,mat);
   mesh.position.set(635+i*168,0,1270-i*7.33);mesh.scale.set(11,22,11);layer.add(mesh);glows.push(mesh);
 }
 // Two closed schematic circuits; these paths do not depict actual drillings.
 const paths={
  oil:[ [570,-105,910],[1510,-105,869],[1510,-105,950],[580,-105,991],[570,-105,910] ],
  coolant:[ [525,150,1070],[1520,150,1027],[1570,150,1350],[610,150,1388],[525,150,1070] ]
 };
 const effects={};
 for(const [name,pts] of Object.entries(paths)){
   const curve=new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p)),true,'centripetal',.4);
   const lineMat=new T.LineBasicMaterial({color:name==='oil'?0xeabb51:0x49b1ce,transparent:true,opacity:.32});
   const poly=new T.BufferGeometry().setFromPoints(curve.getPoints(180));
   layer.add(new T.Line(poly,lineMat));
   const particles=[];
   const count=name==='oil'?21:21;
   for(let i=0;i<count;i++){
     const m=new T.Mesh(sphere,new T.MeshBasicMaterial({color:name==='oil'?0xf3cf64:0x70d7fa,transparent:true,opacity:.85}));
     m.scale.setScalar(5.5);layer.add(m);particles.push(m);
   }
   effects[name]={curve,particles};
 }
 layer.visible=false;
 function enable(flag){on=!!flag;layer.visible=on;}
 function update(physics,dt){if(!on)return;
   elapsed+=(dt||0);
   const pressure=physics.oilPressure||0,rpm=physics.rpm||0;
   const oilFlow=Math.min(1,Math.max(0,(physics.oilFlowLpm||0)/35));
   const coolingFlow=Math.min(1,Math.max(0,(physics.coolantFlowLpm||0)/115));
   for(const [name,sys] of Object.entries(effects)){
     const speed=(name==='oil'?oilFlow:coolingFlow)*.06;
     sys.particles.forEach((m,i)=>{
       const frac=((elapsed*speed+i/sys.particles.length)%1+1)%1;
       m.position.copy(sys.curve.getPointAt(frac));
       m.visible=pressure>6||name==='coolant';
     });
   }
   glows.forEach((m,i)=>{
     const c=physics.cycle(i),bar=physics.pressure(i)/1e5;
     const combusting=c>=350&&c<=433&&rpm>0;
     m.visible=combusting;
     m.material.opacity=combusting?Math.min(.46,.04+bar/150*.35):0;
     const scale=combusting?12+bar*.15:4;
     m.scale.set(scale,scale*1.4,scale);
   });
 }
 function destroy(){engineRoot.remove(layer);}
 return{enable,update,destroy,get enabled(){return on}};
}
root.D13Effects={create};
})(globalThis);
