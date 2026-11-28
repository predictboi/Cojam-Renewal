// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Burns `feeBps` of every transfer between two non zero addresses. TEST ONLY.
contract MockFeeOnTransfer is ERC20 {
    uint256 public immutable feeBps;

    constructor(uint256 supply, uint256 feeBps_) ERC20("Fee CT", "FCT") {
        feeBps = feeBps_;
        _mint(msg.sender, supply);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0) && feeBps > 0) {
            uint256 fee = (value * feeBps) / 10_000;
            super._update(from, address(0), fee);
            super._update(from, to, value - fee);
        } else {
            super._update(from, to, value);
        }
    }
}
