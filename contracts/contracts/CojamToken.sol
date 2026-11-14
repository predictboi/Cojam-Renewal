// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title Cojam Token (new CT on Kaia)
/// @notice The most basic fixed supply token: standard ERC-20 (KIP-7 compatible at the ERC-20 level) and nothing else.
/// The whole supply, 2,000,000,000 CT with 9 decimals, is minted once in this constructor to `master` (the project's
/// master wallet). After that no address can mint, burn, recall, pause, freeze, blacklist, upgrade or charge a fee:
/// the contract has no owner and no function beyond the ERC-20 standard
/// (name, symbol, decimals, totalSupply, balanceOf, transfer, allowance, approve, transferFrom).
contract CojamToken is ERC20 {
    /// @notice 9 decimals, as on a standard Solana SPL token.
    uint8 public constant DECIMALS = 9;

    /// @notice 2,000,000,000 CT in base units (2,000,000,000 x 10^9).
    uint256 public constant TOTAL_SUPPLY = 2_000_000_000 * 10 ** 9;

    /// @param master Receives the whole supply.
    constructor(address master) ERC20("Cojam Token", "CT") {
        // OpenZeppelin's _mint reverts with ERC20InvalidReceiver(address(0)) for the zero address.
        _mint(master, TOTAL_SUPPLY);
    }

    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }
}
