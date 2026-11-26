// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Plain 18 decimal ERC-20 standing in for CT in the staking tests. TEST ONLY.
contract StakingMockCT is ERC20 {
    constructor(uint256 supply) ERC20("Cojam Token", "CT") {
        _mint(msg.sender, supply);
    }
}
