import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';
const root=path.resolve('ios-alarm/preview/public');
const bootstrap=`<script>
localStorage.clear();for(const k of ['tasks','projects','parking_lot','move_checklist','subscriptions','spots','purchases','journals','chat','assistant_items','entries'])localStorage.setItem('lifeclass_'+k,'[]');
localStorage.setItem('lifeclass_cloud_url',location.origin);localStorage.setItem('lifeclass_cloud_key','simulator-preview-fixture-not-a-real-key-12345678');localStorage.setItem('lifeclass_ai_mode','server');
const previewObserver=new MutationObserver(()=>{const form=document.querySelector('.aide-remote-form'),body=document.querySelector('.aide-clock-body');if(form&&body){body.scrollTop=form.offsetTop-body.offsetTop;previewObserver.disconnect();}});previewObserver.observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener('load',()=>setTimeout(()=>window.dispatchEvent(new Event('aide-open-remote-alarms')),600));
</script>`;
http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:24549');res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.writeHead(403,{'Content-Type':'application/json'});res.end(JSON.stringify({code:'PREVIEW_READ_ONLY',message:'화면 미리보기만 가능해요.'}));return;}
 if(url.pathname==='/alarms/status'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({serverNow:Date.now(),nativeAlarmsEnabled:false,backgroundPushConfigured:false,devices:[],requests:[]}));return;}
 if(!url.pathname.startsWith('/life-class/')||url.pathname.includes('/api/')){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({protocol:2,revision:0,records:[],jobs:[],agents:[],recommendations:[],devices:[],requests:[],items:[],suggestions:[],messages:[],cursor:0,hasMore:false,ready:false,code:'PREVIEW_ONLY',message:'화면 미리보기',budget:{blocked:true,limitKrw:30000},registeredIphones:0}));return;}
 const relative=url.pathname.slice(12)||'index.html',file=path.resolve(root,relative);
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 try{let body=await fs.readFile(file);if(relative==='index.html')body=Buffer.from(body.toString().replace('<head>','<head>'+bootstrap));res.setHeader('Content-Type',relative.endsWith('.html')?'text/html; charset=utf-8':relative.endsWith('.js')?'text/javascript':relative.endsWith('.css')?'text/css':'image/png');res.end(body);}catch{res.writeHead(404);res.end();}
}).listen(24549,'127.0.0.1',()=>console.log('Read-only UI fixture ready.'));
