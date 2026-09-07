import { readFile, writeFile } from 'node:fs/promises';
const spm = 'ios/App/CapApp-SPM/Package.swift';
await writeFile(spm, (await readFile(spm, 'utf8')).replaceAll('\\', '/'));
const info = 'ios/App/App/Info.plist';
let plist = await readFile(info, 'utf8');
for (const [key, value] of Object.entries({
  NSCameraUsageDescription: 'Take a cargo photo when you choose Scan cargo.',
  NSPhotoLibraryUsageDescription:
    'Choose cargo photos for the scan preparation screen.',
}))
  if (!plist.includes(`<key>${key}</key>`))
    plist = plist.replace(
      '</dict>',
      `<key>${key}</key><string>${value}</string>\n</dict>`,
    );
await writeFile(info, plist);
const project = 'ios/App/App.xcodeproj/project.pbxproj';
let pbx = await readFile(project, 'utf8');
if (!pbx.includes('PrivacyInfo.xcprivacy in Resources')) {
  pbx = pbx.replace(
    '/* Begin PBXBuildFile section */',
    '/* Begin PBXBuildFile section */\n\t\tA10000000000000000000001 /* PrivacyInfo.xcprivacy in Resources */ = {isa = PBXBuildFile; fileRef = A10000000000000000000002 /* PrivacyInfo.xcprivacy */; };',
  );
  pbx = pbx.replace(
    '/* Begin PBXFileReference section */',
    '/* Begin PBXFileReference section */\n\t\tA10000000000000000000002 /* PrivacyInfo.xcprivacy */ = {isa = PBXFileReference; lastKnownFileType = text.xml; path = PrivacyInfo.xcprivacy; sourceTree = "<group>"; };',
  );
  pbx = pbx.replace(
    '504EC3131FED79650016851F /* Info.plist */,',
    '504EC3131FED79650016851F /* Info.plist */,\n\t\t\t\tA10000000000000000000002 /* PrivacyInfo.xcprivacy */,',
  );
  pbx = pbx.replace(
    '504EC3121FED79650016851F /* LaunchScreen.storyboard in Resources */,',
    '504EC3121FED79650016851F /* LaunchScreen.storyboard in Resources */,\n\t\t\t\tA10000000000000000000001 /* PrivacyInfo.xcprivacy in Resources */,',
  );
}
await writeFile(project, pbx);
console.log(
  'iOS paths, permission descriptions and privacy resource prepared.',
);
