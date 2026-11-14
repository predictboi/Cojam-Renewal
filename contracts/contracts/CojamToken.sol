// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title Cojam Token (new CT on Kaia)
/// @notice The most basic fixed supply token: standard ERC-20 (KIP-7 compatible at the ERC-20 level) and nothing else.
/// The whole supply, 2,000,000,000 CT with the standard 18 decimals, is minted once in this constructor to `master` (the project's
/// master wallet). After that no address can mint, burn, recall, pause, freeze, blacklist, upgrade or charge a fee:
/// the contract has no owner and no function beyond the ERC-20 standard
/// (name, symbol, decimals, totalSupply, balanceOf, transfer, allowance, approve, transferFrom).
contract CojamToken is ERC20 {
    /// @notice 2,000,000,000 CT in base units (2,000,000,000 x 10^18). Decimals are the ERC-20 default of 18,
    /// the same as old CT, so the swap needs no decimal conversion.
    uint256 public constant TOTAL_SUPPLY = 2_000_000_000 * 10 ** 18;

    /// @param master Receives the whole supply.
    constructor(address master) ERC20("Cojam Token", "CT") {
        // OpenZeppelin's _mint reverts with ERC20InvalidReceiver(address(0)) for the zero address.
        _mint(master, TOTAL_SUPPLY);
    }
}
