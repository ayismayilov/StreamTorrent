const { copyFile, access } = require("node:fs/promises");
const path = require("node:path");
exports.default = async (context) => {
  if (context.electronPlatformName !== "win32") return;
  const target = path.join(
    context.appOutDir,
    "resources",
    "app.asar.unpacked",
    "node_modules",
    "node-datachannel",
    "build",
    "Release",
    "node_datachannel.node",
  );
  await access(target);
  await copyFile(
    path.join(
      context.packager.projectDir,
      "vendor",
      "win32-x64",
      "node_datachannel.node",
    ),
    target,
  );
};
