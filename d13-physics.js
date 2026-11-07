/*
 * D13 EngineLab: simplified zero-dimensional (0-D) four-stroke thermodynamics,
 * crank-slider kinematics, lumped oil hydraulic circuit, and coolant heat balance.
 * Geometry nominal values are supplied by the user-provided model; ALL dynamics,
 * coefficients, and torque/pressure limits are illustrative, NOT VOLVO calibration.
 * No combustion CFD, FEA, SAE-certified engine dyno, or validated repair simulation.
 * Exports deliberately work in browsers and Node.js for reproducible tests.
 */
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.D13Physics=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const PI=Math.PI, RAD=PI/180;
  const BORE=.131, STROKE=.158, R=STROKE/2, ROD=.255, COMP=17.0, CYL=6;
  const DISP=PI*BORE*BORE/4*STROKE, VC=DISP/(COMP-1);
  const FIRE=[0,480,240,600,120,360]; // cylinder numbers 1..6 in 1-5-3-6-2-4 order
  const crankPins=FIRE.map(deg=>((-deg%360)+360)%360);
  const mod=(a,b)=>((a%b)+b)%b;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const sineEase=t=>.5-.5*Math.cos(PI*clamp(t,0,1));
  function pin(a) {const t=a*RAD;return {y:R*Math.sin(t),z:R*Math.cos(t)};}
  function slider(a){const t=a*RAD,s=Math.sin(t);return R*Math.cos(t)+Math.sqrt(ROD*ROD-R*R*s*s);}
  function rodTilt(a){const t=a*RAD;return Math.atan2(-R*Math.sin(t),Math.sqrt(ROD*ROD-R*R*Math.sin(t)**2));}
  function volume(a){return VC+PI*BORE*BORE/4*(ROD+R-slider(a));}
  function dVolume(a){const h=.05;return (volume(a+h)-volume(a-h))/(2*h*RAD);}
  function valveLift(cycle,type) {
    const start=type==='intake'?690:480;
    const dur=type==='intake'?240:250;
    const x=mod(cycle-start,720);
    if(x>dur)return 0;
    // Squared sine gives smooth lift and soft opening / closing at the seat.
    const sn=Math.sin(PI*x/dur);return (type==='intake'?11.0:10.0)*sn*sn;
  }
  function burnFraction(cycle){const x=clamp((cycle-351)/65,0,1);return 1-Math.exp(-6.908*x*x*x);}
  class Engine {
    constructor(){this.reset();}
    reset(){
      this.angle=0;this.rpm=0;this.running=false;this.starter=0;
      this.throttle=22;this.load=15;this.ambient=20;this.fan=true;
      this.coolant=85;this.oilTemp=62;this.oilLevel=100;this.coolantLevel=100;
      this.oilPressure=0;this.oilFlowLpm=0;this.coolantFlowLpm=0;this.coolantPressureKpa=0;this.thermostatOpen=0;this.oilLeakLph=0;this.coolantLeakLph=0;this.boostKpa=102;this.railPressure=0;
      this.torque=0;this.netTorque=0;this.fuelGps=0;this.exhaust=100;
      this.damage=0;this.seconds=0;this.simSpeed=1;this.faults={gasket:false,lowOil:false,waterPump:false,radiator:false,oilPump:false,injector:false,airFilter:false,looseBolts:false,coolantLeak:false,thermostatStuck:false};
      this.alerts=[];this._oilPressureLowSec=0;this._engineHeatJ=0;this._oilThermJ=0;
    }
    setFault(name,val){if(Object.hasOwn(this.faults,name))this.faults[name]=!!val;}
    setOil(v){this.oilLevel=clamp(v,0,100);}
    setCoolant(v){this.coolantLevel=clamp(v,0,100);}
    cycle(i){return mod(this.angle-FIRE[i]+360,720);}
    geom(i){const angle=mod(this.angle-FIRE[i],360);return {angle,position:slider(angle),pin:pin(angle),tilt:rodTilt(angle),liftIn:valveLift(this.cycle(i),'intake'),liftEx:valveLift(this.cycle(i),'exhaust'),stroke:this.stroke(i)};}
    stroke(i){const c=this.cycle(i);return c<180?'INTAKE':c<360?'COMPRESSION':c<540?'POWER':'EXHAUST';}
    pressure(i,ang=this.angle, fuelFraction=clamp(this.throttle/100,0,1)){
      const c=mod(ang-FIRE[i]+360,720);
      const vol=volume(c%360),vbdc=volume(180);
      const intake=this.boostKpa*1000;
      if(c<180)return intake*.94;
      if(c<360)return intake*Math.pow(vbdc/vol,1.31);
      if(c<540){
        const adiabatic=intake*Math.pow(vbdc/vol,1.31);
        const injection=this.faults.injector?(i===2?.06:1):1;
        // Synthetic diesel heat-release pressure term, from a Wiebe S-curve.
        const ignition=burnFraction(c), maxAddition=8.7e6*clamp(fuelFraction,0,1);
        const expansion=Math.pow(VC/vol,.94);
        return adiabatic+maxAddition*ignition*expansion*injection;
      }
      return 105000;
    }
    cylinders(){return FIRE.map((_,i)=>({number:i+1,stroke:this.stroke(i),angle:this.geom(i).angle,pressureBar:this.pressure(i)/1e5,volumeMl:volume(this.geom(i).angle)*1e6,inletLiftMm:this.geom(i).liftIn,exhaustLiftMm:this.geom(i).liftEx}));}
    indicativeTorque(fuelFraction){
      // Integral-based p*dV/dtheta: trapped cylinder pressure drives crank.
      // 12 quadrature samples across +-30 degrees suppress numeric firing jitter.
      let torque=0;
      for(let k=0;k<12;k++){
        const a=this.angle+(k-5.5)*5;
        for(let i=0;i<CYL;i++){
          const c=mod(a-FIRE[i]+360,720);
          const p=this.pressure(i,a,fuelFraction)-101325;
          torque+=p*dVolume(c%360)/12;
        }
      }
      return clamp(torque,-2500,4200);
    }
    start(startAllowed=true){if(!startAllowed)return false;
      if(this.oilLevel<8||this.damage>=99)return false;
      this.running=true;this.rpm=660;this.starter=0;return true;
    }
    stop(){this.running=false;this.rpm=0;this.torque=0;this.netTorque=0;this.oilPressure=0;}
    tick(dt,options={}){
      dt=clamp(Number(dt)||0,0,.05);
      if(!this.running){this.oilPressure=Math.max(0,this.oilPressure-dt*120);return this.snapshot();}
      const oldRpm=this.rpm;
      const oilFactor=clamp(this.oilLevel/30,0,1);
      const filterFactor=this.faults.airFilter?.70:1;
      const desiredBoost=101+Math.min(95,Math.max(0,(this.rpm-650)/1700)*70)*(this.throttle/100)*filterFactor;
      this.boostKpa+=(desiredBoost-this.boostKpa)*dt*1.4;
      // Idle governor + pedal fueling, and reduced injection if air is restricted.
      const idle=clamp((680-this.rpm)/360,0,.55);
      const frac=clamp((this.throttle/100*.95)+idle,0,1)*filterFactor;
      const gross=this.indicativeTorque(frac);
      const friction=120+this.rpm*.047+(this.oilTemp<45?35:0)+this.damage*2;
      const external=clamp(this.load/100,0,1)*1600*Math.max(.4,this.rpm/1600);
      this.torque=gross-friction;
      this.netTorque=this.torque-external;
      // Inertia of rotating train / flywheel (illustrative 25 kg.m^2); dissipative governor.
      const inertia=25;
      const omega=Math.max(0,this.rpm)*2*PI/60;
      const nextOmega=omega+(this.netTorque/inertia)*dt;
      this.rpm=clamp(nextOmega*60/(2*PI),0,2450);
      if(this.rpm<270){this.stop();this.alerts=['STALL: insufficient net torque.'];return this.snapshot();}
      if(this.rpm>=2430)this.rpm=2430; // training governor, not engine-rated setting
      const avgRpm=(oldRpm+this.rpm)*.5;
      this.angle=mod(this.angle+avgRpm*6*dt,720);
      this.seconds+=dt;
      // Fuel flow: synthetic proxy from combustion work and fueling demand.
      this.fuelGps=(.33+14.5*frac*(this.rpm/1750))*(this.faults.injector?.96:1);
      this.exhaust+=((185+440*frac)-this.exhaust)*dt*.7;
      // Lumped oil pump: RPM-driven positive displacement flow, relief valve,
      // viscosity/temperature losses, galleries, bypass leakage and failed pump.
      const viscosity=clamp(Math.exp((90-this.oilTemp)*.012),.42,2.2);
      const pumpFlow=clamp(this.rpm/650,0,4)*oilFactor*(this.faults.oilPump?.14:1);
      const leakConductance=1+(this.faults.looseBolts?.12:0)+(this.faults.gasket?.08:0)+this.damage*.004;
      this.oilFlowLpm=this.faults.oilPump?0:clamp(23*this.rpm/650*oilFactor/Math.sqrt(viscosity),0,92);
      const targetPressure=this.faults.oilPump?5:clamp(35+145*pumpFlow*viscosity/leakConductance,0,540);
      this.oilPressure+=(targetPressure-this.oilPressure)*clamp(dt*5,0,1);
      if(this.oilLevel<12)this.oilPressure*=.993;
      // Oil losses drain available sump volume; these are fictional training rates.
      let leakLps=0;
      if(this.faults.gasket)leakLps+=.00038*(1+this.rpm/1200);
      if(this.faults.looseBolts)leakLps+=.00052;
      if(this.faults.lowOil)leakLps+=.0014;
      this.oilLeakLph=leakLps*3600;
      this.oilLevel=clamp(this.oilLevel-leakLps*dt/34*100,0,100); // illustrative 34-L sump
      // Thermal lump: fuel heat input, coolant pump transfer, thermostat and radiator.
      const lossW=this.fuelGps*.001*42e6*.28; // approximate fraction transferred to coolant
      this.thermostatOpen=this.faults.thermostatStuck?0:clamp((this.coolant-82)/12,0,1);
      this.coolantFlowLpm=clamp(136*this.rpm/1200*(this.faults.waterPump?.04:1)*clamp(this.coolantLevel/35,0,1),0,320);
      const pumpFactor=clamp(this.coolantFlowLpm/110,.035,2.8);
      this.coolantPressureKpa=clamp(85+(this.coolant-85)*1.9-(100-this.coolantLevel)*1.1,0,160);
      this.coolantLeakLph=this.faults.coolantLeak?13:0;
      this.coolantLevel=clamp(this.coolantLevel-this.coolantLeakLph*dt/3600/55*100,0,100); // example 55L system
      const transfer=(this.oilTemp-this.coolant)*225*pumpFactor;
      const thermostat=this.thermostatOpen;
      const airflow=(this.fan?1.6:.5)+(this.faults.radiator?-1.2:0);
      const radTransfer=Math.max(0,(this.coolant-this.ambient)*thermostat*140*airflow*pumpFactor);
      // 500k J/K equivalent lumped coolant/iron and ~160k J/K engine oil/lubricated metal.
      this.coolant=clamp(this.coolant+(lossW*.62+transfer-radTransfer)/500000*dt,0,165);
      this.oilTemp=clamp(this.oilTemp+(lossW*.38-transfer)/160000*dt,0,190);
      if(this.faults.waterPump) this.coolant+=.017*dt*this.rpm/700;
      if(this.coolantLevel<30)this.coolant+=.035*dt;
      if(this.coolantLevel<15)this.coolant+=.12*dt;
      const pressureMin=this.rpm>500?100:50;
      if(this.oilPressure<pressureMin)this._oilPressureLowSec+=dt;else this._oilPressureLowSec=Math.max(0,this._oilPressureLowSec-dt*.5);
      if(this._oilPressureLowSec>3)this.damage=clamp(this.damage+dt*.32,0,100);
      if(this.coolant>115)this.damage=clamp(this.damage+dt*(this.coolant-115)*.004,0,100);
      this.alerts=[];
      if(this.oilPressure<pressureMin)this.alerts.push('LOW OIL PRESSURE — stop and investigate.');
      if(this.coolant>107)this.alerts.push('COOLANT OVERTEMPERATURE.');
      if(this.oilLevel<25)this.alerts.push('LOW OIL LEVEL.');
      if(this.faults.gasket)this.alerts.push('SEAL LEAK — oil is being lost.');
      if(this.faults.coolantLeak)this.alerts.push('COOLANT LEAK — coolant inventory falling.');
      if(this.coolantLevel<25)this.alerts.push('LOW COOLANT LEVEL.');
      if(this.damage>5)this.alerts.push('CUMULATIVE DAMAGE (illustrative).');
      if(this.oilLevel<5||this.damage>=99||this.coolant>149){this.stop();this.alerts.push('AUTOMATIC MODEL SHUTDOWN.');}
      return this.snapshot();
    }
    snapshot(){return {running:this.running,rpm:this.rpm,angle:this.angle,coolant:this.coolant,oilTemp:this.oilTemp,oilLevel:this.oilLevel,coolantLevel:this.coolantLevel,oilPressure:this.oilPressure,oilFlowLpm:this.oilFlowLpm,coolantFlowLpm:this.coolantFlowLpm,coolantPressureKpa:this.coolantPressureKpa,thermostatOpen:this.thermostatOpen,oilLeakLph:this.oilLeakLph,coolantLeakLph:this.coolantLeakLph,boostKpa:this.boostKpa,fuelGps:this.fuelGps,torque:this.torque,netTorque:this.netTorque,damage:this.damage,seconds:this.seconds,alerts:this.alerts.slice()};}
    pressureTrace(cylinder=0,interval=5){const arr=[];for(let a=0;a<=720;a+=interval)arr.push({angle:a,bar:this.pressure(cylinder,this.angle+((a-this.cycle(cylinder))%720))/1e5,volume:volume(a%360)*1e6});return arr;}
  }
  return {Engine,FIRE,crankPins,BORE,STROKE,ROD,R,DISP,COMP,volume,slider,rodTilt,pin,valveLift,mod};
});
