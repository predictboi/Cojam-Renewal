// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title Cojam Rehearsal (CTR), TEST ONLY
/// @notice Stand in for new CT in the small mainnet rehearsal (scripts/ops.js, task rehearse-mainnet).
/// A different name and symbol so nobody mistakes it for new CT. Same fixed supply as CojamToken
/// (2,000,000,000), because CojamMigration requires it to cover the old supply at 0.4. Never list or pool it.
contract CojamRehearsalToken is ERC20 {
    uint256 public constant TOTAL_SUPPLY = 2_000_000_000 * 10 ** 18;

    constructor(address master) ERC20("Cojam Rehearsal", "CTR") {
        _mint(master, TOTAL_SUPPLY);
    }
}
