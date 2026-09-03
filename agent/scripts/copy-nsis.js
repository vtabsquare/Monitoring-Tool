const fs = require('fs');
const path = require('path');

function copyInstaller() {
  const buildOutputDir = path.join(__dirname, '../release/build');
  const targetDir = path.join(__dirname, '../release/installer');
  const targetPath = path.join(targetDir, 'FlowFocusDesktopAgentSetup.exe');

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const files = fs.readdirSync(buildOutputDir);
  const exeFile = files.find(f => f.endsWith('.exe') && !f.includes('unpacked'));

  if (exeFile) {
    const srcPath = path.join(buildOutputDir, exeFile);
    fs.copyFileSync(srcPath, targetPath);
    console.log(`[NSIS Installer] Successfully generated and copied installer to: ${targetPath}`);
  } else {
    console.error('[NSIS Installer] Could not find compiled setup EXE in build output folder.');
  }
}

copyInstaller();
