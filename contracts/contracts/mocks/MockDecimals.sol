// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Token with configurable decimals, used to test the deploy guards. TEST ONLY.
contract MockDecimals is ERC20 {
    uint8 private immutable _dec;

    constructor(uint256 supply, uint8 dec) ERC20("Dec", "DEC") {
        _dec = dec;
        _mint(msg.sender, supply);
    }

    function decimals() public view override returns (uint8) {
        return _dec;
    }
}
