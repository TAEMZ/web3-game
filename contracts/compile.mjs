// Compile the Arena contracts with solc, resolving @openzeppelin imports from
// node_modules. Writes artifacts (abi + bytecode) to contracts/artifacts/.
import solc from "solc";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const NODE_MODULES = join(__dirname, "node_modules");

const SOURCES = ["ArenaToken.sol", "ArenaEscrow.sol", "TestUSD.sol", "ArenaExchange.sol"];

// solc import callback — resolve OZ (and any relative) imports from disk.
function findImport(path) {
  try {
    // @openzeppelin/... lives in node_modules
    const full = path.startsWith(".")
      ? resolve(__dirname, path)
      : join(NODE_MODULES, path);
    return { contents: readFileSync(full, "utf8") };
  } catch (e) {
    return { error: "File not found: " + path + " (" + e.message + ")" };
  }
}

const sources = {};
for (const f of SOURCES) sources[f] = { content: readFileSync(join(__dirname, f), "utf8") };

const input = {
  language: "Solidity",
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
};

console.log("solc version:", solc.version());
const out = JSON.parse(solc.compile(JSON.stringify(input), { import: findImport }));

if (out.errors) {
  let fatal = false;
  for (const e of out.errors) {
    console.log(e.formattedMessage);
    if (e.severity === "error") fatal = true;
  }
  if (fatal) {
    console.error("COMPILE FAILED");
    process.exit(1);
  }
}

const artDir = join(__dirname, "artifacts");
if (!existsSync(artDir)) mkdirSync(artDir);

const wanted = {
  "ArenaToken.sol": "ArenaToken",
  "ArenaEscrow.sol": "ArenaEscrow",
  "TestUSD.sol": "TestUSD",
  "ArenaExchange.sol": "ArenaExchange",
};
for (const [file, name] of Object.entries(wanted)) {
  const c = out.contracts[file][name];
  const artifact = { abi: c.abi, bytecode: "0x" + c.evm.bytecode.object };
  writeFileSync(join(artDir, name + ".json"), JSON.stringify(artifact, null, 2));
  console.log(`✓ compiled ${name}  (bytecode ${artifact.bytecode.length / 2 - 1} bytes)`);
}
console.log("artifacts written to contracts/artifacts/");
