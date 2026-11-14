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
  'event Migrated(address indexed user, uint256 indexed lotId, uint256 oldAmount, uint256 instantAmount, uint256 lockedAmount, uint256 unlockAt)',
  'event Claimed(address indexed user, uint256 indexed lotId, uint256 amount, address indexed caller)',
  'error NothingToClaim()',
  'error ZeroAmount()',
  'error WindowClosed()',
  'error InsufficientReserve(uint256 available, uint256 needed)',
  'error EnforcedPause()',
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

// Owner only functions of CojamMigration (Ownable2Step). Listed so tests can prove the
// policy never sponsors them; the policy itself is an allowlist and needs no denylist.
const ownerAbi = new Interface([
  'function pauseMigrate()',
  'function unpauseMigrate()',
  'function withdrawReserve(address to, uint256 amount)',
  'function recoverERC20(address token, address to, uint256 amount)',
  'function transferOwnership(address newOwner)',
  'function acceptOwnership()',
  'function renounceOwnership()',
]);

const TOPICS = {
  Migrated: swapAbi.getEvent('Migrated').topicHash,
  Claimed: swapAbi.getEvent('Claimed').topicHash,
};

module.exports = { oldCtAbi, swapAbi, ownerAbi, SELECTORS, TOPICS };
