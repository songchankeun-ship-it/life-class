// Generate the app and its required AlarmKit countdown Live Activity extension.
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {deflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('./',import.meta.url)),id=s=>createHash('sha256').update(s).digest('hex').slice(0,24).toUpperCase();
const put=(p,s)=>writeFileSync(root+p,s),dir=p=>mkdirSync(root+p,{recursive:true});
dir('AideAlarms.xcodeproj/xcshareddata/xcschemes');dir('Assets.xcassets/AppIcon.appiconset');
const rows=[],add=(key,body)=>rows.push(id(key)+' = {'+body+'};');
const appFiles=['AideAlarms.swift','AideWebView.swift','AideAlarmModels.swift'];
const widgetFiles=['AideAlarmWidget.swift','AideAlarmModels.swift'];
const refs=[...new Set([...appFiles,...widgetFiles,'Info.plist','WidgetInfo.plist','AideAlarms.entitlements','Assets.xcassets'])];
for(const f of refs)add(f,'isa = PBXFileReference; lastKnownFileType = '+(f.endsWith('.swift')?'sourcecode.swift':f.endsWith('.xcassets')?'folder.assetcatalog':'text.plist.xml')+'; path = "'+f+'"; sourceTree = "<group>";');
add('app','isa = PBXFileReference; explicitFileType = wrapper.application; path = AideAlarms.app; sourceTree = BUILT_PRODUCTS_DIR;');
add('widget','isa = PBXFileReference; explicitFileType = "wrapper.app-extension"; path = AideAlarmWidget.appex; sourceTree = BUILT_PRODUCTS_DIR;');
add('group','isa = PBXGroup; children = ('+refs.map(id).join(',')+','+id('products')+'); sourceTree = "<group>";');
add('products','isa = PBXGroup; children = ('+id('app')+','+id('widget')+'); name = Products; sourceTree = "<group>";');
for(const [target,files] of [['app',appFiles],['widget',widgetFiles]]){
 for(const f of files)add(target+f,'isa = PBXBuildFile; fileRef = '+id(f)+';');
 add(target+'sources','isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = ('+files.map(f=>id(target+f)).join(',')+'); runOnlyForDeploymentPostprocessing = 0;');
 add(target+'frameworks','isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0;');
 add(target+'resources','isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = ('+(target==='app'?id('assetBuild'):'')+'); runOnlyForDeploymentPostprocessing = 0;');
 const phases=[id(target+'sources'),id(target+'frameworks'),id(target+'resources'),...(target==='app'?[id('embed')]:[])];
 add(target+'target','isa = PBXNativeTarget; buildConfigurationList = '+id(target+'Configs')+'; buildPhases = ('+phases.join(',')+'); buildRules = (); dependencies = ('+(target==='app'?id('dependency'):'')+'); name = '+(target==='app'?'AideAlarms':'AideAlarmWidget')+'; productName = '+(target==='app'?'AideAlarms':'AideAlarmWidget')+'; productReference = '+id(target)+'; productType = "com.apple.product-type.'+(target==='app'?'application':'app-extension')+'";');
}
add('assetBuild','isa = PBXBuildFile; fileRef = '+id('Assets.xcassets')+';');
add('embedBuild','isa = PBXBuildFile; fileRef = '+id('widget')+'; settings = {ATTRIBUTES = (RemoveHeadersOnCopy,);};');
add('embed','isa = PBXCopyFilesBuildPhase; buildActionMask = 2147483647; dstPath = ""; dstSubfolderSpec = 13; files = ('+id('embedBuild')+'); name = "Embed App Extensions"; runOnlyForDeploymentPostprocessing = 0;');
add('proxy','isa = PBXContainerItemProxy; containerPortal = '+id('project')+'; proxyType = 1; remoteGlobalIDString = '+id('widgettarget')+'; remoteInfo = AideAlarmWidget;');
add('dependency','isa = PBXTargetDependency; target = '+id('widgettarget')+'; targetProxy = '+id('proxy')+';');
for(const kind of ['project','app','widget']){
 for(const name of ['Debug','Release']){
  let settings='SDKROOT = iphoneos; IPHONEOS_DEPLOYMENT_TARGET = 26.0; SWIFT_VERSION = 5.0;';
  if(kind!=='project')settings+=' AIDE_BUNDLE_ID = com.aide.personal.alarms; PRODUCT_BUNDLE_IDENTIFIER = "$(AIDE_BUNDLE_ID)'+(kind==='widget'?'.widgets':'')+'"; PRODUCT_NAME = "$(TARGET_NAME)"; MARKETING_VERSION = 0.2.0; CURRENT_PROJECT_VERSION = 2; INFOPLIST_FILE = '+(kind==='app'?'Info.plist':'WidgetInfo.plist')+'; GENERATE_INFOPLIST_FILE = NO; CODE_SIGN_STYLE = Automatic; TARGETED_DEVICE_FAMILY = 1; SUPPORTED_PLATFORMS = "iphoneos iphonesimulator"; SUPPORTS_MACCATALYST = NO; SWIFT_EMIT_LOC_STRINGS = YES; '+(kind==='app'?'CODE_SIGN_ENTITLEMENTS = AideAlarms.entitlements; ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;':'APPLICATION_EXTENSION_API_ONLY = YES; SKIP_INSTALL = YES;');
  settings+=' ALWAYS_SEARCH_USER_PATHS = NO;';
  if(kind!=='project')settings+=' PROVISIONING_PROFILE_SPECIFIER = "$('+(kind==='app'?'AIDE_APP_PROFILE':'AIDE_WIDGET_PROFILE')+')";';
  add(kind+name,'isa = XCBuildConfiguration; buildSettings = {'+settings+'}; name = '+name+';');
 }
 add(kind+'Configs','isa = XCConfigurationList; buildConfigurations = ('+id(kind+'Debug')+','+id(kind+'Release')+'); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;');
}
add('project','isa = PBXProject; attributes = {LastUpgradeCheck = 2600;}; buildConfigurationList = '+id('projectConfigs')+'; compatibilityVersion = "Xcode 14.0"; developmentRegion = ko; hasScannedForEncodings = 0; knownRegions = (ko,en,Base); mainGroup = '+id('group')+'; productRefGroup = '+id('products')+'; projectDirPath = ""; projectRoot = ""; targets = ('+id('apptarget')+','+id('widgettarget')+');');
put('AideAlarms.xcodeproj/project.pbxproj','// !$*UTF8*$!\n{archiveVersion = 1; classes = {}; objectVersion = 56; objects = {\n'+rows.join('\n')+'\n}; rootObject = '+id('project')+';}\n');
const target='<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="'+id('apptarget')+'" BuildableName="AideAlarms.app" BlueprintName="AideAlarms" ReferencedContainer="container:AideAlarms.xcodeproj"/>';
put('AideAlarms.xcodeproj/xcshareddata/xcschemes/AideAlarms.xcscheme','<?xml version="1.0" encoding="UTF-8"?><Scheme LastUpgradeVersion="2600" version="1.3"><BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">'+target+'</BuildActionEntry></BuildActionEntries></BuildAction><LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" allowLocationSimulation="NO"><BuildableProductRunnable runnableDebuggingMode="0">'+target+'</BuildableProductRunnable></LaunchAction><ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" savedToolIdentifier="" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"><BuildableProductRunnable runnableDebuggingMode="0">'+target+'</BuildableProductRunnable></ProfileAction><AnalyzeAction buildConfiguration="Debug"/><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/></Scheme>');
put('Assets.xcassets/Contents.json',JSON.stringify({info:{author:'xcode',version:1}}));
put('Assets.xcassets/AppIcon.appiconset/Contents.json',JSON.stringify({images:[{filename:'AppIcon.png',idiom:'universal',platform:'ios',size:'1024x1024'}],info:{author:'xcode',version:1}}));
// Original code-drawn icon; no external artwork, network or imaging packages.
const size=1024,pixels=Buffer.alloc((size*3+1)*size),glyph=['01110','00001','01111','10001','01111'];
for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=y*(size*3+1)+1+x*3,col=Math.floor((x-282)/92),row=Math.floor((y-282)/92),white=col>=0&&col<5&&row>=0&&row<5&&glyph[row][col]==='1';pixels[i]=white?255:91;pixels[i+1]=white?255:123;pixels[i+2]=white?255:232;}
function crc32(data){let n=0xffffffff;for(const b of data){n^=b;for(let k=0;k<8;k++)n=(n>>>1)^((n&1)?0xedb88320:0);}return (n^0xffffffff)>>>0;}
function chunk(type,data){const t=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([len,t,data,crc]);}
const header=Buffer.alloc(13);header.writeUInt32BE(size);header.writeUInt32BE(size,4);header[8]=8;header[9]=2;
put('Assets.xcassets/AppIcon.appiconset/AppIcon.png',Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]));
process.stdout.write('Generated AideAlarms.xcodeproj and original app icon. No signing keys used.\n');
