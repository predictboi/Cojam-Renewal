require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const { PRIVATE_KEY, KAIROS_RPC_URL, KAIA_RPC_URL } = process.env;
const accounts = PRIVATE_KEY ? [PRIVATE_KEY] : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // Conservative target: no PUSH0 or transient storage opcodes, so the
      // bytecode runs on every Kaia hardfork and on the Kairos testnet.
      evmVersion: "paris",
    },
  },
  networks: {
    hardhat: {
      // Lets the fork test run old Kaia blocks (Hardhat needs a hardfork for chain 8217).
      chains: {
        8217: { hardforkHistory: { shanghai: 0 } },
      },
    },
    kairos: {
      url: KAIROS_RPC_URL || "https://public-en-kairos.node.kaia.io",
      chainId: 1001,
      accounts,
    },
    kaia: {
      url: KAIA_RPC_URL || "https://public-en.node.kaia.io",
      chainId: 8217,
      accounts,
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
  },
  mocha: { timeout: 120000 },
};
