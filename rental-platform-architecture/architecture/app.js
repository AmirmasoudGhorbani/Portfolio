(function(){
  "use strict";

  var I = {
    traveler:'<circle cx="12" cy="8" r="3.4"/><path d="M5.5 20a6.5 6.5 0 0113 0"/>',
    host:'<circle cx="12" cy="8" r="3.4"/><path d="M5.5 20a6.5 6.5 0 0113 0"/>',
    route53:'<path d="M5 7l2.5 11h9L19 7"/><path d="M3.5 7h17"/><path d="M9 7V5a3 3 0 016 0v2"/>',
    cdn:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    elb:'<circle cx="12" cy="5" r="2.4"/><circle cx="6" cy="18" r="2.4"/><circle cx="18" cy="18" r="2.4"/><path d="M12 7.4v4M12 11.4L6.6 15.8M12 11.4l5.4 4.4"/>',
    payment:'<rect x="3" y="6" width="18" height="12" rx="2.2"/><path d="M3 10h18"/><circle cx="16.5" cy="14.5" r="1.6"/>',
    view:'<rect x="3" y="4" width="18" height="16" rx="2.2"/><path d="M3 9h18M7 13h6M7 16h9"/>',
    guest:'<circle cx="9" cy="9" r="3"/><path d="M3.5 19a5.5 5.5 0 0111 0"/><path d="M16 7h5M18.5 4.5v5" stroke-linecap="round"/>',
    search:'<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5" stroke-linecap="round"/>',
    update:'<path d="M20 11a8 8 0 10-2.3 6.3L20 15"/><path d="M20 20v-5h-5"/>',
    queue:'<rect x="3" y="8" width="3.5" height="8" rx="1"/><rect x="8" y="8" width="3.5" height="8" rx="1"/><rect x="13" y="8" width="3.5" height="8" rx="1"/><path d="M19 9l2 3-2 3" stroke-linecap="round"/>',
    broker:'<path d="M4 12h9" stroke-linecap="round"/><rect x="13" y="8" width="3" height="8" rx="1"/><rect x="17.5" y="8" width="3" height="8" rx="1"/>',
    db:'<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
    rds:'<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M9 13v4M12 11v6M15 13v4" stroke-linecap="round"/>',
    s3:'<path d="M5 5h14l-1.4 14.2a1 1 0 01-1 .8H7.4a1 1 0 01-1-.8z"/><path d="M4 5h16" stroke-linecap="round"/><circle cx="10" cy="11" r="1.1"/><path d="M13 10h3M13 13h3"/>',
    es:'<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5" stroke-linecap="round"/><path d="M9 11h4M11 9v4" stroke-linecap="round"/>',
    room:'<path d="M4 11l8-6 8 6"/><path d="M6 10v9h12v-9"/><path d="M9 19v-4h6v4"/>'
  };

  var N = {
    traveler:{x:40,y:80,w:210,h:260,cat:'actor',shape:'actor',ic:'traveler',nm:'Traveler / Guest',sub:'Books a room',
      svc:'End user (web / mobile client)',
      resp:'Browses listings, searches by city/date, views a room, and completes a booking & payment.',
      scale:['Served global static assets from CloudFront edge locations','All dynamic calls enter through Route 53 → ALB'],
      tech:['Web','Mobile','REST/HTTPS']},

    route53:{x:230,y:410,w:120,h:120,cat:'net',shape:'round',ic:'route53',nm:'Route 53',
      svc:'Amazon Route 53 (DNS)',
      resp:'Authoritative DNS. Resolves the platform domain and routes clients to the load balancer, with health-checked failover.',
      scale:['Latency / geolocation routing policies','Health checks reroute away from unhealthy regions','Effectively infinite QPS — fully managed'],
      tech:['DNS','Health checks','Failover']},

    elb:{x:400,y:410,w:120,h:120,cat:'net',shape:'round',ic:'elb',nm:'Load Balancer',
      svc:'Elastic Load Balancing (ALB)',
      resp:'Terminates TLS and spreads incoming requests across healthy service tasks. Path-based rules route to each microservice target group.',
      scale:['Auto-scales capacity units with traffic','Health checks drop unhealthy targets','Cross-AZ distribution for resilience'],
      tech:['ALB','TLS','Target groups']},

    cloudfront:{x:240,y:630,w:120,h:120,cat:'net',shape:'round',ic:'cdn',nm:'CloudFront CDN',
      svc:'Amazon CloudFront',
      resp:'Caches listing photos, JS/CSS and other static assets at the edge, close to the user — cutting latency and origin load.',
      scale:['Global edge POPs','Origin = S3 photos bucket','Cache invalidation on new uploads'],
      tech:['CDN','Edge cache','TLS']},

    payment:{x:600,y:150,w:200,h:118,cat:'compute',shape:'card',badge:'EC2',ic:'payment',nm:'Payment Service',
      svc:'Microservice on Amazon EC2',
      resp:'Processes booking payments via an external gateway, then emits a “booking confirmed” event onto the queue for downstream updates.',
      scale:['Stateless — behind the ALB','Idempotent payment handling','Publishes events, never writes the index directly'],
      tech:['EC2','Payments','Events']},

    view:{x:600,y:300,w:200,h:118,cat:'compute',shape:'card',badge:'EC2',ic:'view',nm:'View Service',
      svc:'Microservice on Amazon EC2',
      resp:'Renders listing detail pages and aggregates read-only data for the client. Read-heavy and cache-friendly.',
      scale:['Horizontally scaled read replicas','CloudFront / app-level caching','No write responsibilities'],
      tech:['EC2','Read API','Cache']},

    guest:{x:600,y:450,w:200,h:118,cat:'compute',shape:'card',badge:'EC2',ic:'guest',nm:'Guest Service',
      svc:'Microservice on Amazon EC2',
      resp:'Owns guest profiles, trips and booking records. The booking request a guest submits is orchestrated here.',
      scale:['Stateless app tier, state in RDS','Auto Scaling group across AZs','Session via token, not server memory'],
      tech:['EC2','Bookings','Profiles']},

    search:{x:600,y:620,w:200,h:118,cat:'compute',shape:'card',badge:'ECS',ic:'search',nm:'Search Service',
      svc:'Microservice on Amazon ECS',
      resp:'Serves fast catalog search (city, dates, filters) by querying the Elasticsearch index rather than hitting the primary DB.',
      scale:['Containerised tasks on ECS','Queries the search index, not the DB','Scales independently of write load'],
      tech:['ECS','Elasticsearch','Filters']},

    broker:{x:838,y:280,w:64,h:58,cat:'intg',shape:'mini',ic:'broker',nm:'Message Broker',
      svc:'Event entry to the queue',
      resp:'Receives domain events from services and hands them to the durable queue for asynchronous processing.',
      scale:['Decouples producers from consumers','Buffers spikes'],
      tech:['Events','Pub/Sub']},

    queue:{x:880,y:362,w:280,h:140,cat:'intg',shape:'group-card',ic:'queue',nm:'Queue / Messaging',
      svc:'Amazon SQS',
      resp:'Durable FIFO buffer between write-producing services and the Update Service. Absorbs bursts and guarantees at-least-once delivery.',
      scale:['Smooths traffic spikes into steady writes','Retries + dead-letter queue for failures','Producers and consumers scale separately'],
      tech:['SQS','FIFO','DLQ']},

    update:{x:930,y:558,w:180,h:120,cat:'compute',shape:'card',ic:'update',nm:'Update Service',
      svc:'Queue consumer (EC2 / ECS)',
      resp:'Drains the queue and applies writes: persists to the primary DB and re-indexes the listing into Elasticsearch so search stays fresh.',
      scale:['Consumer count scales with queue depth','Idempotent, retry-safe writes','Keeps DB + search index consistent'],
      tech:['Worker','DB write','Re-index']},

    db:{x:856,y:738,w:96,h:108,cat:'db',shape:'cyl',ic:'db',nm:'Primary DB',
      svc:'Source-of-truth datastore',
      resp:'Authoritative store for listings, bookings and availability. Written by the Update Service, read by the search indexer.',
      scale:['Read replicas for read scaling','Primary for writes','Backed up & multi-AZ'],
      tech:['SQL','Replicas','Backups']},

    es:{x:1010,y:720,w:230,h:128,cat:'search',shape:'card',ic:'es',nm:'Elasticsearch',
      svc:'Elasticsearch / Apache Solr',
      resp:'Inverted-index search cluster. Powers sub-100ms catalog queries and faceted filtering, decoupled from the primary DB.',
      scale:['Sharded + replicated index','Re-indexed asynchronously by Update Service','Scales reads independently of the DB'],
      tech:['Search','Sharding','Facets']},

    s3:{x:1040,y:88,w:120,h:120,cat:'storage',shape:'tile',ic:'s3',nm:'Amazon S3',
      svc:'Amazon S3 — Photos',
      resp:'Object storage for listing photos and media. Served to users through CloudFront for low-latency delivery.',
      scale:['11 9’s durability','Origin for the CDN','Lifecycle rules to cheaper tiers'],
      tech:['S3','Media','Durable']},

    rds:{x:1230,y:70,w:210,h:150,cat:'db',shape:'tile',ic:'rds',nm:'Amazon RDS',
      svc:'Amazon RDS (managed SQL)',
      resp:'Managed relational database for host & listing data — the Host Service’s system of record.',
      scale:['Multi-AZ standby for failover','Read replicas','Automated backups & patching'],
      tech:['RDS','Multi-AZ','Managed']},

    host:{x:1200,y:350,w:210,h:300,cat:'compute',shape:'host',badge:'EC2',ic:'host',nm:'Host Service',
      svc:'Microservice on Amazon EC2',
      resp:'Lets landlords create & manage listings. Uploads photos to S3, persists to RDS, and enqueues update events so the public catalog & search index refresh.',
      scale:['Stateless tier behind the ALB','Writes go through the queue, not directly to search','Auto Scaling group'],
      tech:['EC2','Listings','Uploads']},

    landlord:{x:1480,y:350,w:180,h:260,cat:'actor',shape:'actor',ic:'host',nm:'Landlord / Host',sub:'Lists a room',
      svc:'End user (host portal)',
      resp:'Creates and updates room listings, sets pricing & availability, and uploads photos.',
      scale:['Same edge + ALB entry as guests','Writes flow through the Host Service'],
      tech:['Web','Host portal']},

    room:{x:1370,y:680,w:240,h:170,cat:'misc',shape:'tile',ic:'room',nm:'Room For Rent',
      svc:'The listing (domain entity)',
      resp:'A published room: details in RDS, photos in S3, and a searchable copy in Elasticsearch for travelers to find.',
      scale:['Photos via CDN','Discoverable through search index'],
      tech:['Listing','Availability']}
  };

  var E = [
    ['traveler','R','route53','L','read'],
    ['route53','R','elb','L','read'],
    ['route53','B','cloudfront','T','read'],
    ['elb','R','view','L','read'],
    ['elb','R','guest','L','read'],
    ['elb','R','payment','L','read'],
    ['elb','R','search','L','read'],
    ['payment','R','broker','L','write'],
    ['broker','R','queue','L','write'],
    ['queue','B','update','T','write'],
    ['update','B','db','T','write'],
    ['update','R','es','L','write'],
    ['search','R','es','L','read'],
    ['host','T','rds','B','write'],
    ['host','L','queue','R','write'],
    ['landlord','L','host','R','write'],
    ['landlord','B','room','T','write'],
    ['host','T','s3','B','write']
  ];

  var catName={net:'Networking & Delivery',compute:'Compute',storage:'Storage',db:'Database',intg:'App Integration',search:'Search & Analytics',actor:'Actor',misc:'Domain'};
  var catVar={net:'--net',compute:'--compute',storage:'--storage',db:'--db',intg:'--intg',search:'--search',actor:'--actor',misc:'--misc'};

  var stage=document.getElementById('stage'), wires=document.getElementById('wires');

  function nodeHTML(id,n){
    var color='var('+catVar[n.cat]+')';
    var el=document.createElement('div');
    el.className='node'+(n.shape==='round'?' round':'')+(n.shape==='actor'?' actor':'')+(n.shape==='cyl'?' cyl':'');
    el.id='n_'+id; el.dataset.id=id;
    el.style.cssText='left:'+n.x+'px;top:'+n.y+'px;width:'+n.w+'px;height:'+n.h+'px;color:'+color;
    var glyph='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round">'+(I[n.ic]||'')+'</svg>';
    var inner='';
    if(n.shape==='round'){
      inner='<div class="card"><div class="ico">'+glyph+'</div></div><div class="clbl">'+n.nm+'</div>';
    } else if(n.shape==='actor'){
      inner='<div class="card"><div class="ico">'+glyph+'</div><div class="nm">'+n.nm+'</div><div class="sub">'+(n.sub||'')+'</div></div>';
    } else if(n.shape==='cyl'){
      inner='<div class="card cyl-card"><div class="ico">'+glyph+'</div><div class="nm">'+n.nm+'</div></div>';
    } else if(n.shape==='tile'){
      inner='<div class="card svc tile-card"><div class="ico">'+glyph+'</div><div class="nm">'+n.nm+'</div></div>';
    } else if(n.shape==='mini'){
      inner='<div class="card mini-card"><div class="ico">'+glyph+'</div></div>';
    } else if(n.shape==='group-card'){
      inner='<div class="card svc"><div class="top"><div class="ico">'+glyph+'</div><div><div class="nm">'+n.nm+'</div><div class="meta">Enqueue → Dequeue</div></div></div></div>';
    } else if(n.shape==='host'){
      inner='<div class="card svc host-card">'+(n.badge?'<span class="badge">'+n.badge+'</span>':'')+'<div class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">'+I.host+'</svg></div><div class="nm">'+n.nm+'</div><div class="meta">Amazon EC2</div></div>';
    } else {
      inner='<div class="card svc">'+(n.badge?'<span class="badge">'+n.badge+'</span>':'')+'<div class="top"><div class="ico">'+glyph+'</div><div><div class="nm">'+n.nm+'</div><div class="meta">'+(n.badge||n.cat)+'</div></div></div></div>';
    }
    el.innerHTML=inner;
    el.addEventListener('click',function(){ openDrawer(id); });
    el.addEventListener('mouseenter',function(e){ showTip(e,n); });
    el.addEventListener('mousemove',moveTip);
    el.addEventListener('mouseleave',hideTip);
    return el;
  }
  for(var id in N) stage.appendChild(nodeHTML(id,N[id]));

  function addGroup(x,y,w,h,label,plain){
    var g=document.createElement('div'); g.className='group'+(plain?' plain':'');
    g.style.cssText='left:'+x+'px;top:'+y+'px;width:'+w+'px;height:'+h+'px;';
    g.innerHTML='<span class="glabel">'+label+'</span>';
    stage.insertBefore(g,stage.firstChild.nextSibling);
  }
  addGroup(560,110,300,760,'MICROSERVICES · EC2 / ECS');
  addGroup(866,348,300,168,'QUEUE / MESSAGING',true);

  function anchor(n,side){
    var cx=n.x+n.w/2, cy=n.y+n.h/2;
    if(side==='L') return {x:n.x,y:cy,nx:-1,ny:0};
    if(side==='R') return {x:n.x+n.w,y:cy,nx:1,ny:0};
    if(side==='T') return {x:cx,y:n.y,nx:0,ny:-1};
    return {x:cx,y:n.y+n.h,nx:0,ny:1};
  }
  function pathD(a,b){
    var k=Math.max(40,Math.min(120,Math.abs(a.x-b.x)*0.4+Math.abs(a.y-b.y)*0.4));
    var c1x=a.x+a.nx*k, c1y=a.y+a.ny*k, c2x=b.x+b.nx*k, c2y=b.y+b.ny*k;
    return 'M'+a.x+' '+a.y+' C'+c1x+' '+c1y+' '+c2x+' '+c2y+' '+b.x+' '+b.y;
  }

  wires.innerHTML='<defs>'+
    '<marker id="ar" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M1 1L8 4.5L1 8z" fill="rgba(255,255,255,0.25)"/></marker>'+
    '<marker id="arRead" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M1 1L8 4.5L1 8z" fill="#818cf8"/></marker>'+
    '<marker id="arWrite" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M1 1L8 4.5L1 8z" fill="#f472b6"/></marker>'+
    '<marker id="arFlow" markerWidth="10" markerHeight="10" refX="7" refY="5" orient="auto"><path d="M1 1L9 5L1 9z" fill="#a78bfa"/></marker>'+
    '</defs>';
  var edgeEls=[];
  E.forEach(function(e){
    var a=anchor(N[e[0]],e[1]), b=anchor(N[e[2]],e[3]);
    var p=document.createElementNS('http://www.w3.org/2000/svg','path');
    p.setAttribute('d',pathD(a,b));
    p.setAttribute('marker-end','url(#ar)');
    p.dataset.from=e[0]; p.dataset.to=e[2]; p.dataset.path=e[4];
    wires.appendChild(p); edgeEls.push(p);
  });

  function findEdge(from,to){ return edgeEls.find(function(p){ return p.dataset.from===from && p.dataset.to===to; }); }

  var tip=document.getElementById('tip');
  function showTip(e,n){ tip.innerHTML='<span class="tt">'+n.nm+'</span><br>'+(n.svc||''); tip.style.opacity='1'; moveTip(e); }
  function moveTip(e){ var x=e.clientX+14, y=e.clientY+16; if(x>innerWidth-240)x=e.clientX-226; tip.style.left=x+'px'; tip.style.top=y+'px'; }
  function hideTip(){ tip.style.opacity='0'; }

  var drawer=document.getElementById('drawer'), scrim=document.getElementById('scrim');
  function openDrawer(id){
    var n=N[id]; var cv='var('+catVar[n.cat]+')';
    var cat=document.getElementById('drCat');
    cat.textContent=catName[n.cat]; cat.style.color=cv; cat.style.background='color-mix(in srgb,'+cv+' 14%, #14142a)';
    var t=document.getElementById('drTitle'); t.textContent=n.nm;
    document.getElementById('drSvc').textContent=n.svc||'';
    var body=document.getElementById('drBody'); body.innerHTML='';
    body.appendChild(sec('Responsibility','<p>'+n.resp+'</p>'));
    if(n.scale) body.appendChild(sec('Scaling & resilience','<ul>'+n.scale.map(function(s){return '<li>'+s+'</li>';}).join('')+'</ul>'));
    if(n.tech) body.appendChild(sec('Tech','<div class="chips">'+n.tech.map(function(c){return '<span class="chip">'+c+'</span>';}).join('')+'</div>'));
    drawer.classList.add('open'); scrim.classList.add('show');
    clearHL(); hl(id);
  }
  function sec(h,inner){ var d=document.createElement('div'); d.className='dr-sec'; d.innerHTML='<h3>'+h+'</h3>'+inner; return d; }
  function closeDrawer(){ drawer.classList.remove('open'); scrim.classList.remove('show'); clearHL(); }
  document.getElementById('drClose').addEventListener('click',closeDrawer);
  scrim.addEventListener('click',closeDrawer);

  function hl(id){
    document.getElementById('n_'+id).classList.add('on');
    edgeEls.forEach(function(p){ if(p.dataset.from===id||p.dataset.to===id){ p.classList.add('hot'); } else { p.classList.add('dim'); } });
    Object.keys(N).forEach(function(k){ if(k!==id){ var conn=edgeEls.some(function(p){ return (p.dataset.from===id&&p.dataset.to===k)||(p.dataset.to===id&&p.dataset.from===k); }); if(!conn) document.getElementById('n_'+k).classList.add('dim'); } });
  }
  function clearHL(){
    document.querySelectorAll('.node').forEach(function(el){ el.classList.remove('on','dim','ping'); });
    edgeEls.forEach(function(p){ p.classList.remove('hot','dim','read','write','flow'); p.setAttribute('marker-end','url(#ar)'); });
  }

  var activePath=null;
  function setPath(path){
    clearHL(); closePathBtns();
    if(activePath===path){ activePath=null; return; }
    activePath=path;
    document.getElementById(path==='read'?'readBtn':'writeBtn').classList.add('on');
    var nodes={};
    edgeEls.forEach(function(p){
      if(p.dataset.path===path||p.dataset.path==='both'){
        p.classList.add(path); p.classList.remove('dim'); p.setAttribute('marker-end', path==='read'?'url(#arRead)':'url(#arWrite)');
        nodes[p.dataset.from]=1; nodes[p.dataset.to]=1;
      } else { p.classList.add('dim'); }
    });
    if(path==='read') nodes['db']=1;
    Object.keys(N).forEach(function(k){ document.getElementById('n_'+k).classList.toggle('dim',!nodes[k]); document.getElementById('n_'+k).classList.toggle('on',!!nodes[k]); });
  }
  function closePathBtns(){ document.getElementById('readBtn').classList.remove('on'); document.getElementById('writeBtn').classList.remove('on'); }
  document.getElementById('readBtn').addEventListener('click',function(){ setPath('read'); });
  document.getElementById('writeBtn').addEventListener('click',function(){ setPath('write'); });
  document.getElementById('reset').addEventListener('click',function(){ activePath=null; closePathBtns(); clearHL(); closeDrawer(); });

  var token=document.getElementById('token'), playing=false;
  var seqBooking=['traveler','route53','elb','guest','payment','broker','queue','update','db','es'];
  var seqListing=['landlord','host','s3','host','rds','host','queue','update','db','es'];
  function center(id){ var n=N[id]; return {x:n.x+n.w/2,y:n.y+n.h/2}; }
  function playSeq(seq){
    if(playing) return; playing=true; clearHL(); closePathBtns(); activePath=null;
    Object.keys(N).forEach(function(k){ document.getElementById('n_'+k).classList.add('dim'); });
    token.style.opacity='1';
    var i=0, prev=null;
    function hop(){
      if(i>=seq.length){ token.style.opacity='0'; playing=false; setTimeout(clearHL,400); return; }
      var id=seq[i]; var c=center(id);
      var nodeEl=document.getElementById('n_'+id);
      nodeEl.classList.remove('dim'); nodeEl.classList.add('on');
      if(prev){ var ed=findEdge(prev,id)||findEdge(id,prev); if(ed){ ed.classList.remove('dim'); ed.classList.add('flow'); ed.setAttribute('marker-end','url(#arFlow)'); } }
      var sx=parseFloat(token.style.left)||c.x, sy=parseFloat(token.style.top)||c.y;
      if(i===0){ sx=c.x; sy=c.y; }
      var t0=null, dur=520;
      function step(ts){
        if(!t0)t0=ts; var k=Math.min(1,(ts-t0)/dur); var e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
        token.style.left=(sx+(c.x-sx)*e-9)+'px'; token.style.top=(sy+(c.y-sy)*e-9)+'px';
        if(k<1){ requestAnimationFrame(step); }
        else { nodeEl.classList.add('ping'); setTimeout(function(){ nodeEl.classList.remove('ping'); },700); prev=id; i++; setTimeout(hop,140); }
      }
      requestAnimationFrame(step);
    }
    hop();
  }
  document.getElementById('play').addEventListener('click',function(){ playSeq(seqBooking); });
  document.getElementById('playHost').addEventListener('click',function(){ playSeq(seqListing); });

  var lg=document.getElementById('legend');
  ['net','compute','storage','db','intg','search'].forEach(function(c){
    var s=document.createElement('div'); s.className='lg';
    s.innerHTML='<span class="d" style="background:var('+catVar[c]+')"></span>'+catName[c];
    lg.appendChild(s);
  });

  var fit=document.getElementById('fit'), wrap=document.getElementById('wrap');
  function scaleStage(){
    var avail=wrap.clientWidth-52; var s=Math.min(1,avail/1680);
    fit.style.transform='scale('+s+')';
    fit.style.width='1680px';
    fit.style.height=(940*s)+'px';
  }
  window.addEventListener('resize',scaleStage); scaleStage();
})();
