(function(){
  "use strict";
  var N = 48;
  var buffer = [];
  var mode = 'sim';
  var client = null;
  var apiTimer = null, apiTimes = null;

  function seed(){
    var buf=[], t=25.5, h=61, p=16;
    for(var i=0;i<N;i++){
      t += (Math.random()-0.5)*0.7 + Math.sin(i/6)*0.18;
      h += (Math.random()-0.5)*1.1 - Math.sin(i/6)*0.25;
      p += (Math.random()-0.5)*1.6 + Math.sin(i/9)*0.35;
      t=clamp(t,19,33); h=clamp(h,38,78); p=clamp(p,5,52);
      buf.push({t:t,h:h,p:p});
    }
    return buf;
  }
  function clamp(v,a,b){ return Math.min(b,Math.max(a,v)); }
  function aqiFromPm(pm){
    var bp=[[0,12,0,50],[12.1,35.4,51,100],[35.5,55.4,101,150],[55.5,150.4,151,200]],i;
    for(i=0;i<bp.length;i++){ var b=bp[i]; if(pm<=b[1]) return Math.round((b[3]-b[2])/(b[1]-b[0])*(pm-b[0])+b[2]); }
    return 250;
  }
  function aqiLabel(a){ return a<=50?'Good':a<=100?'Moderate':a<=150?'Unhealthy (SG)':'Unhealthy'; }
  function aqiColor(a){ return a<=50?'#3fd07a':a<=100?'#ffb24d':'#ff5d6c'; }
  function comfort(t,h){ if(t>=30||h>=72) return 'Warm / Humid'; if(t<=20) return 'Cool'; if(h<40) return 'Dry'; return 'Comfortable'; }

  function pushPoint(pt){
    if(!isFinite(pt.t)||!isFinite(pt.h)||!isFinite(pt.p)) return;
    buffer.push(pt); if(buffer.length>N) buffer.shift();
    render();
  }
  function tick(){
    if(mode!=='sim') return;
    var last=buffer[buffer.length-1];
    pushPoint({ t:clamp(last.t+(Math.random()-0.5)*0.6,19,33),
                h:clamp(last.h+(Math.random()-0.5)*1.0,38,78),
                p:clamp(last.p+(Math.random()-0.5)*1.5,5,52) });
  }

  function $(id){ return document.getElementById(id); }
  function set(id,v){ var e=$(id); if(e) e.textContent=v; }
  function pts(map,key,base,top,max){
    return buffer.map(function(b,i){ var x=44+692*i/(N-1); var y=base-(clamp(b[key],0,max)/max)*(base-top); return x.toFixed(1)+','+y.toFixed(1); }).join(' ');
  }
  function area(p,base){ return 'M44,'+base+' L'+p.split(' ').join(' L')+' L736,'+base+' Z'; }

  function render(){
    var cur=buffer[buffer.length-1], old=buffer[0];
    var temp=cur.t, hum=cur.h, pm=cur.p, aqi=aqiFromPm(pm);
    var feels=temp+(hum-50)*0.04+(temp>27?(temp-27)*0.18:0);
    var ac=aqiColor(aqi), al=aqiLabel(aqi);
    var dt=temp-old.t, dh=hum-old.h;
    function dArrow(v){ return v>=0?'↑':'↓'; }
    function dCol(v){ return v>=0?'#ff8a5c':'#4d9bff'; }

    var liveLbl = mode==='live'?'LIVE · MQTT':mode==='api'?'LIVE · AUCKLAND':'LIVE · SIM';
    var liveCol = (mode==='live'||mode==='api')?'#3fd07a':'#34d3e6';
    $('livePill').querySelector('.dot').style.background=liveCol;
    $('livePill').querySelector('.dot').style.boxShadow='0 0 10px '+liveCol;
    $('livePill').querySelector('.lbl').textContent=liveLbl;
    $('livePill').querySelector('.lbl').style.color=liveCol;
    [['a_dot','a_live']].forEach(function(p){
      $(p[0]).style.background=liveCol; $(p[0]).style.boxShadow='0 0 9px '+liveCol;
      set(p[1],liveLbl); $(p[1]).style.color=liveCol;
    });

    set('a_temp',temp.toFixed(1)); set('a_hum',hum.toFixed(1));
    set('a_aqi',aqi); $('a_aqi').style.color=ac;
    set('a_pm',pm.toFixed(1)); set('a_pm2',pm.toFixed(1));
    $('a_tdelta').textContent=dArrow(dt)+' '+Math.abs(dt).toFixed(1)+' °C'; $('a_tdelta').style.color=dCol(dt);
    $('a_hdelta').textContent=dArrow(dh)+' '+Math.abs(dh).toFixed(1)+' %'; $('a_hdelta').style.color=dCol(dh);
    $('a_aqidot').style.background=ac; set('a_aqilabel',al);
    set('a_feels',feels.toFixed(1)); set('a_comfort',comfort(temp,hum));

    var aT=pts(0,'t',214,24,40), aH=pts(0,'h',214,24,100), aP=pts(0,'p',214,24,60);
    $('a_tline').setAttribute('points',aT); $('a_hline').setAttribute('points',aH); $('a_pline').setAttribute('points',aP);
    $('a_area').setAttribute('d',area(aT,214));

    var now=new Date();
    var clock=now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});
    set('a_clock',clock); set('a_clock2',clock);

    var cap = mode==='api'?'vs 48h ago':(mode==='live'?'vs recent':'vs 5 min ago');
    set('a_tcap',cap); set('a_hcap',cap);

    var labels='';
    if(mode==='api' && apiTimes && apiTimes.length>1){
      for(var k=0;k<6;k++){ var ix=Math.round(k*(apiTimes.length-1)/5); var dd=new Date(apiTimes[ix]); labels+='<span>'+dd.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})+'</span>'; }
    } else {
      for(var i=5;i>=0;i--){ var d=new Date(now.getTime()-i*8*60000); labels+='<span>'+d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})+'</span>'; }
    }
    $('a_xaxis').innerHTML=labels;

    var alerts=[];
    if(temp>=31) alerts.push({c:'#ff5d6c',t:'High temperature',m:temp.toFixed(1)+'°C exceeds 31°C threshold'});
    if(aqi>50) alerts.push({c:'#ffb24d',t:'Air quality degrading',m:'AQI '+aqi+' — '+al});
    if(hum<40) alerts.push({c:'#4d9bff',t:'Low humidity',m:hum.toFixed(0)+'% below comfort range'});
    $('a_alerts').innerHTML = alerts.map(function(a){
      return '<div class="alert" style="border-left:3px solid '+a.c+'"><span class="ad" style="background:'+a.c+';box-shadow:0 0 9px '+a.c+'"></span><span class="at">'+a.t+'</span><span class="am">'+a.m+'</span></div>';
    }).join('');

    var rows=[
      ['Sensors', mode==='api'?'Open-Meteo':'Online', '#3fd07a'],
      ['Raspberry Pi', mode==='api'?'—':'Online', mode==='api'?'#7d8aa3':'#3fd07a'],
      [mode==='api'?'Weather API':'MQTT Broker', mode==='live'?'Connected':(mode==='api'?'Live':'Sim mode'), (mode==='live'||mode==='api')?'#3fd07a':'#34d3e6'],
      ['Node-RED', mode==='api'?'—':'Running', mode==='api'?'#7d8aa3':'#3fd07a']
    ];
    $('a_status').innerHTML = rows.map(function(r){
      return '<div class="srow"><span class="k"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="'+r[2]+'" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>'+r[0]+'</span><span class="v" style="color:'+r[2]+'">'+r[1]+'</span></div>';
    }).join('');
  }

  var AKL_LAT=-36.8485, AKL_LON=174.7633;
  function fetchAuckland(){
    $('connState').textContent='fetching Auckland…';
    var fUrl='https://api.open-meteo.com/v1/forecast?latitude='+AKL_LAT+'&longitude='+AKL_LON+'&hourly=temperature_2m,relative_humidity_2m&past_days=2&forecast_days=1&timezone=auto';
    var aUrl='https://air-quality-api.open-meteo.com/v1/air-quality?latitude='+AKL_LAT+'&longitude='+AKL_LON+'&hourly=pm2_5&past_days=2&forecast_days=1&timezone=auto';
    Promise.all([fetch(fUrl).then(function(r){return r.json();}), fetch(aUrl).then(function(r){return r.json();})])
      .then(function(res){
        var fd=res[0], ad=res[1];
        var times=fd.hourly.time, temps=fd.hourly.temperature_2m, hums=fd.hourly.relative_humidity_2m;
        var pmMap={}, pt=ad.hourly.time, pv=ad.hourly.pm2_5;
        for(var j=0;j<pt.length;j++) pmMap[pt[j]]=pv[j];
        var buf=[], tarr=[], nowMs=Date.now();
        for(var i=0;i<times.length;i++){
          if(temps[i]==null||hums[i]==null) continue;
          if(new Date(times[i]).getTime()>nowMs) continue;
          var pm=pmMap[times[i]]; if(pm==null) pm=10;
          buf.push({t:temps[i],h:hums[i],p:pm}); tarr.push(times[i]);
        }
        if(!buf.length) throw new Error('no data');
        buffer=buf.slice(-N); apiTimes=tarr.slice(-N); mode='api';
        var last=apiTimes[apiTimes.length-1];
        $('connState').textContent='live · Auckland · '+new Date(last).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
        render();
      })
      .catch(function(err){ mode='sim'; $('connState').textContent='Auckland fetch failed — simulated'; console.error('Auckland fetch error:', err); render(); });
  }
  function stopApi(){ if(apiTimer){ clearInterval(apiTimer); apiTimer=null; } apiTimes=null; }

  function connect(){
    var src=$('src').value;
    if(client){ try{ client.end(true); }catch(e){} client=null; }
    stopApi();
    if(src==='sim'){ mode='sim'; $('connState').textContent='simulated'; render(); return; }
    if(src==='api'){ fetchAuckland(); apiTimer=setInterval(fetchAuckland,300000); return; }
    if(!window.mqtt){ $('connState').textContent='mqtt.js not loaded'; return; }
    var url=$('broker').value.trim(), topic=$('topic').value.trim();
    $('connState').textContent='connecting…';
    try{
      client=window.mqtt.connect(url);
      client.on('connect',function(){ mode='live'; $('connState').textContent='connected · '+topic; client.subscribe(topic); render(); });
      client.on('message',function(tp,msg){
        try{ var d=JSON.parse(msg.toString());
          pushPoint({ t:+(d.temperature!=null?d.temperature:d.temp!=null?d.temp:d.t),
                      h:+(d.humidity!=null?d.humidity:d.hum!=null?d.hum:d.h),
                      p:+(d.pm25!=null?d.pm25:d.pm!=null?d.pm:d.p) });
        }catch(e){}
      });
      client.on('error',function(){ mode='sim'; $('connState').textContent='connection error — simulated'; });
      client.on('close',function(){ if(mode==='live'){ mode='sim'; $('connState').textContent='disconnected — simulated'; } });
    }catch(e){ mode='sim'; $('connState').textContent='error — simulated'; }
  }
  $('connectBtn').addEventListener('click',connect);

  // sidebar navigation
  var navItems = ['navDashboard','navChart','navAlerts','navSettings'];
  var scrollTargets = {
    navDashboard: 'a_alerts',
    navChart: 'a_tline',
    navAlerts: 'a_alerts',
    navSettings: 'connState'
  };

  function setActiveNav(id){
    navItems.forEach(function(n){
      var el = $(n);
      if(!el) return;
      if(n===id){ el.classList.add('active'); el.querySelector('svg').setAttribute('stroke','#7fc0ff'); }
      else { el.classList.remove('active'); el.querySelector('svg').setAttribute('stroke','#566275'); }
    });
  }

  navItems.forEach(function(navId){
    var el = $(navId);
    if(!el) return;
    el.style.cursor='pointer';
    el.addEventListener('click',function(){
      setActiveNav(navId);
      var targetId = scrollTargets[navId];
      var target = $(targetId);
      if(target) target.scrollIntoView({behavior:'smooth',block:'center'});
      if(navId==='navSettings'){
        $('src').focus();
      }
    });
  });

  buffer=seed();
  render();
  setInterval(tick,2000);
  setInterval(render,1000);
  $('src').value='api';
  fetchAuckland();
  apiTimer=setInterval(fetchAuckland,300000);
})();
