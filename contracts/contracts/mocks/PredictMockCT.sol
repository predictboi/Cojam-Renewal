// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Plain ERC-20 standing in for new CT in the CojamPredict tests. Anyone may mint. TEST ONLY.
contract PredictMockCT is ERC20 {
    uint8 private immutable _dec;

    /// @param dec Decimals to report (18 for CT; other values test the deploy guard).
    constructor(uint8 dec) ERC20("Mock Cojam Token", "CT") {
        _dec = dec;
    }

    /// @notice Mints `amount` base units to `to`. TEST ONLY.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @inheritdoc ERC20
    function decimals() public view override returns (uint8) {
        return _dec;
    }
}
