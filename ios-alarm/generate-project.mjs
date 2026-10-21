// No dependencies or Xcode project generator installation required.
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {deflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('./',import.meta.url)),id=s=>createHash('sha256').update(s).digest('hex').slice(0,24).toUpperCase();
const put=(p,s)=>writeFileSync(root+p,s),dir=p=>mkdirSync(root+p,{recursive:true});
dir('AideAlarms.xcodeproj/xcshareddata/xcschemes');dir('Assets.xcassets/AppIcon.appiconset');
const refs=['AideAlarms.swift','Info.plist','AideAlarms.entitlements','Assets.xcassets'];
const config=name=>`${id('project'+name)} = {isa = XCBuildConfiguration; buildSettings = {SDKROOT = iphoneos; IPHONEOS_DEPLOYMENT_TARGET = 26.0; SWIFT_VERSION = 5.0;}; name = ${name};};
${id('target'+name)} = {isa = XCBuildConfiguration; buildSettings = {PRODUCT_BUNDLE_IDENTIFIER = "com.aide.personal.alarms"; PRODUCT_NAME = "$(TARGET_NAME)"; MARKETING_VERSION = 0.1.0; CURRENT_PROJECT_VERSION = 1; INFOPLIST_FILE = Info.plist; GENERATE_INFOPLIST_FILE = NO; CODE_SIGN_ENTITLEMENTS = AideAlarms.entitlements; CODE_SIGN_STYLE = Automatic; TARGETED_DEVICE_FAMILY = 1; SUPPORTED_PLATFORMS = "iphoneos iphonesimulator"; SUPPORTS_MACCATALYST = NO; ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon; SWIFT_EMIT_LOC_STRINGS = YES; SWIFT_VERSION = 5.0; IPHONEOS_DEPLOYMENT_TARGET = 26.0;}; name = ${name};};`;
put('AideAlarms.xcodeproj/project.pbxproj',`// !$*UTF8*$!
{archiveVersion = 1; classes = {}; objectVersion = 56; objects = {
${refs.map(f=>`${id(f)} = {isa = PBXFileReference; lastKnownFileType = ${f.endsWith('.swift')?'sourcecode.swift':f.endsWith('.xcassets')?'folder.assetcatalog':'text.plist.xml'}; path = "${f}"; sourceTree = "<group>";};`).join('\n')}
${id('app')} = {isa = PBXFileReference; explicitFileType = wrapper.application; path = AideAlarms.app; sourceTree = BUILT_PRODUCTS_DIR;};
${id('swiftBuild')} = {isa = PBXBuildFile; fileRef = ${id(refs[0])};};
${id('assetBuild')} = {isa = PBXBuildFile; fileRef = ${id(refs[3])};};
${id('group')} = {isa = PBXGroup; children = (${refs.map(id).join(',')},${id('products')}); sourceTree = "<group>";};
${id('products')} = {isa = PBXGroup; children = (${id('app')}); name = Products; sourceTree = "<group>";};
${id('sources')} = {isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = (${id('swiftBuild')}); runOnlyForDeploymentPostprocessing = 0;};
${id('resources')} = {isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = (${id('assetBuild')}); runOnlyForDeploymentPostprocessing = 0;};
${id('frameworks')} = {isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0;};
${id('target')} = {isa = PBXNativeTarget; buildConfigurationList = ${id('targetConfigs')}; buildPhases = (${id('sources')},${id('frameworks')},${id('resources')}); buildRules = (); dependencies = (); name = AideAlarms; productName = AideAlarms; productReference = ${id('app')}; productType = "com.apple.product-type.application";};
${id('project')} = {isa = PBXProject; attributes = {LastUpgradeCheck = 2600; TargetAttributes = {${id('target')} = {CreatedOnToolsVersion = 26.0;};};}; buildConfigurationList = ${id('projectConfigs')}; compatibilityVersion = "Xcode 14.0"; developmentRegion = ko; hasScannedForEncodings = 0; knownRegions = (ko,en,Base); mainGroup = ${id('group')}; productRefGroup = ${id('products')}; projectDirPath = ""; projectRoot = ""; targets = (${id('target')});};
${['Debug','Release'].map(config).join('\n')}
${['project','target'].map(kind=>`${id(kind+'Configs')} = {isa = XCConfigurationList; buildConfigurations = (${id(kind+'Debug')},${id(kind+'Release')}); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;};`).join('\n')}
}; rootObject = ${id('project')};}
`);
const target=`<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="${id('target')}" BuildableName="AideAlarms.app" BlueprintName="AideAlarms" ReferencedContainer="container:AideAlarms.xcodeproj"/>`;
put('AideAlarms.xcodeproj/xcshareddata/xcschemes/AideAlarms.xcscheme',`<?xml version="1.0" encoding="UTF-8"?><Scheme LastUpgradeVersion="2600" version="1.3"><BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">${target}</BuildActionEntry></BuildActionEntries></BuildAction><LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" allowLocationSimulation="NO"><BuildableProductRunnable runnableDebuggingMode="0">${target}</BuildableProductRunnable></LaunchAction><ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" savedToolIdentifier="" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"><BuildableProductRunnable runnableDebuggingMode="0">${target}</BuildableProductRunnable></ProfileAction><AnalyzeAction buildConfiguration="Debug"/><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/></Scheme>`);
put('Assets.xcassets/Contents.json',JSON.stringify({info:{author:'xcode',version:1}}));
put('Assets.xcassets/AppIcon.appiconset/Contents.json',JSON.stringify({images:[{filename:'AppIcon.png',idiom:'universal',platform:'ios',size:'1024x1024'}],info:{author:'xcode',version:1}}));
// Original code-drawn icon; no external artwork, network or imaging packages.
const size=1024,pixels=Buffer.alloc((size*4+1)*size),glyph=['01110','00001','01111','10001','01111'];
for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=y*(size*4+1)+1+x*4,col=Math.floor((x-282)/92),row=Math.floor((y-282)/92),white=col>=0&&col<5&&row>=0&&row<5&&glyph[row][col]==='1';pixels[i]=white?255:91;pixels[i+1]=white?255:123;pixels[i+2]=white?255:232;pixels[i+3]=255;}
function crc32(data){let n=0xffffffff;for(const b of data){n^=b;for(let k=0;k<8;k++)n=(n>>>1)^((n&1)?0xedb88320:0);}return (n^0xffffffff)>>>0;}
function chunk(type,data){const t=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([len,t,data,crc]);}
const header=Buffer.alloc(13);header.writeUInt32BE(size);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
put('Assets.xcassets/AppIcon.appiconset/AppIcon.png',Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]));
process.stdout.write('Generated AideAlarms.xcodeproj and original app icon. No signing keys used.\n');
