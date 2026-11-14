'use strict';

// Only the fragments this service touches. Names and signatures match
// contracts/contracts/CojamMigration.sol and the KIP-7 / ERC-20 old CT.

const { Interface } = require('ethers');

const oldCtAbi = new Interface([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
]);

const swapAbi = new Interface([
  'function migrate(uint256 amount) returns (uint256 lotId)',
  'function claim(uint256 maxLots) returns (uint256 amount)',
  'function claimFor(address user, uint256 maxLots) returns (uint256 amount)',
  'function claimForMany(address[] users, uint256 maxLotsEach) returns (uint256 total)',
  'function OLD_TOKEN() view returns (address)',
  'function NEW_TOKEN() view returns (address)',
  'function LOCK_PERIOD() view returns (uint256)',
  'function nextClaimIndex(address user) view returns (uint256)',
  'function lotCount(address user) view returns (uint256)',
  'function claimable(address user, uint256 maxLots) view returns (uint256 amount, uint256 lots)',
  'event Migrated(address indexed user, uint256 indexed lotId, uint256 oldAmount, uint256 newAmount, uint256 instantAmount, uint256 lockedAmount, uint256 unlockAt)',
  'function previewSwap(uint256 oldAmount) view returns (uint256 credit, uint256 instant, uint256 locked)',
  'event Claimed(address indexed user, uint256 indexed lotId, uint256 amount, address indexed caller)',
  'error NothingToClaim()',
  'error ZeroAmount()',
  'error WindowClosed()',
  'error InsufficientReserve(uint256 available, uint256 needed)',
  'error AmountTooSmall()',
  'error NotMaster()',
  'error NothingReceived()',
  'error ReceivedMoreThanSent()',
]);

const SELECTORS = {
  approve: oldCtAbi.getFunction('approve').selector, // 0x095ea7b3
  migrate: swapAbi.getFunction('migrate').selector,
  claim: swapAbi.getFunction('claim').selector,
  claimFor: swapAbi.getFunction('claimFor').selector,
  claimForMany: swapAbi.getFunction('claimForMany').selector,
};

// Functions the fee payer must never pay for: the master's own withdraw (the master pays
// its own gas) and admin style selectors that CojamMigration does not have. Listed only so
// tests can prove the allowlist refuses them.
const notSponsoredAbi = new Interface([
  'function withdraw(uint256 amount)',
  'function sweep() returns (uint256 amount)',
  'function pauseMigrate()',
  'function withdrawReserve(address to, uint256 amount)',
  'function recoverERC20(address token, address to, uint256 amount)',
  'function transferOwnership(address newOwner)',
]);

const TOPICS = {
  Migrated: swapAbi.getEvent('Migrated').topicHash,
  Claimed: swapAbi.getEvent('Claimed').topicHash,
};

module.exports = { oldCtAbi, swapAbi, notSponsoredAbi, SELECTORS, TOPICS };
