'use strict';
// Compiles SpikePredict.sol with solc-js 0.8.28 (optimizer 200 runs, EVM paris, the same settings as contracts/).
// Writes build/SpikePredict.json (abi, bytecode) and build/standard-input.json + build/metadata.json for Sourcify.
const fs = require('node:fs');
const path = require('node:path');
const solc = require('solc');

const SOURCE = 'SpikePredict.sol';

function compile() {
  const input = {
    language: 'Solidity',
    sources: { [SOURCE]: { content: fs.readFileSync(path.join(__dirname, SOURCE), 'utf8') } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'paris',
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object', 'metadata'] } },
    },
  };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (out.errors || []).filter((e) => e.severity === 'error');
  for (const e of out.errors || []) console.error(e.formattedMessage);
  if (errors.length) throw new Error('Compilation failed');
  const c = out.contracts[SOURCE].SpikePredict;
  const build = path.join(__dirname, 'build');
  fs.mkdirSync(build, { recursive: true });
  const artifact = {
    contractName: 'SpikePredict',
    compiler: solc.version(),
    abi: c.abi,
    bytecode: '0x' + c.evm.bytecode.object,
    deployedBytecode: '0x' + c.evm.deployedBytecode.object,
  };
  fs.writeFileSync(path.join(build, 'SpikePredict.json'), JSON.stringify(artifact, null, 2));
  fs.writeFileSync(path.join(build, 'standard-input.json'), JSON.stringify(input, null, 2));
  fs.writeFileSync(path.join(build, 'metadata.json'), c.metadata);
  return artifact;
}

if (require.main === module) {
  const a = compile();
  console.log(`compiled ${a.contractName} with ${a.compiler}: ${(a.deployedBytecode.length - 2) / 2} bytes runtime`);
}
module.exports = { compile };
