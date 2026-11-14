// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title Cojam Rehearsal (CTR), TEST ONLY
/// @notice Stand in for new CT in the small mainnet rehearsal (scripts/ops.js, task rehearse-mainnet).
/// A different name and symbol so nobody mistakes it for new CT. Same fixed supply as CojamToken,
/// because CojamMigration requires the new supply to cover the old one. Never list or pool it.
contract CojamRehearsalToken is ERC20 {
    uint256 public constant TOTAL_SUPPLY = 4_083_262_533_956_000_100_000_000_000;

    constructor(address master) ERC20("Cojam Rehearsal", "CTR") {
        _mint(master, TOTAL_SUPPLY);
    }
}
