// CI-only visual preview. It patches only the disposable checkout, never the shipping project.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const folder='ios-alarm/preview/public';mkdirSync(folder,{recursive:true});
const origin='https://aide-personal-assistant.songchankeun.workers.dev';
const page=await fetch(origin+'/life-class/');if(!page.ok)throw Error('PUBLIC_PREVIEW_UNAVAILABLE');
const html=await page.text();
const assets=[...new Set([...html.matchAll(/(?:src|href)="(\/life-class\/assets\/[^"?#]+\.(?:js|css))"/g)].map(m=>m[1]))];
if(assets.length!==2)throw Error('PUBLIC_PREVIEW_ASSET_COUNT');
writeFileSync(folder+'/index.html',html);
for(const asset of assets){
 const r=await fetch(origin+asset);if(!r.ok)throw Error('PUBLIC_PREVIEW_ASSET_UNAVAILABLE');
 const data=Buffer.from(await r.arrayBuffer());mkdirSync(folder+'/assets',{recursive:true});writeFileSync(folder+asset.slice('/life-class'.length),data);
 console.log('Public preview asset SHA256: '+createHash('sha256').update(data).digest('hex'));
}
const swift='ios-alarm/AideAlarms.swift',web='ios-alarm/AideWebView.swift',plist='ios-alarm/Info.plist';
function replace(path,from,to){const s=readFileSync(path,'utf8');if(!s.includes(from))throw Error('PREVIEW_PATCH_TARGET_CHANGED');writeFileSync(path,s.replace(from,to));}
replace(swift,'@State private var selectedTab = CredentialStore.load() == nil ? 1 : 0','@State private var selectedTab = ProcessInfo.processInfo.arguments.contains("--aide-preview-alarm") ? 0 : 1');
replace(swift,'.onChange(of: phase) { _, value in executor.active(value == .active) }.task { executor.active(true) }','// Preview: no executor loop, permissions, APNs or server alarm calls.');
replace(web,'view.load(URLRequest(url: URL(string: "https://"+origin+"/life-class/")!))','view.load(URLRequest(url: URL(string: "http://127.0.0.1:24549/life-class/")!))');
replace(web,'guard let url = action.request.url else { decisionHandler(.cancel); return }','guard let url = action.request.url else { decisionHandler(.cancel); return }; if url.scheme == "http", url.host == "127.0.0.1", url.port == 24549 { decisionHandler(.allow); return }');
replace(plist,'<key>LSRequiresIPhoneOS</key>','<key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/><key>NSAllowsArbitraryLoadsInWebContent</key><true/></dict><key>LSRequiresIPhoneOS</key>');
console.log('Disposable preview only: native executor disabled; local fixture has no real keys or user data.');
