// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @title Cojam Token (new CT on Kaia)
/// @notice Plain fixed supply ERC-20 (KIP-7 compatible at the ERC-20 level).
/// The whole supply is minted once, in this constructor, to `master` (the
/// project's master wallet). The master then funds the migration contract by
/// plain transfers. The token itself has no owner, no mint after deploy,
/// no pause, no blacklist, no fee and no upgrade path.
/// @dev ERC20Permit (EIP-2612) only adds signature based approvals for holders.
contract CojamToken is ERC20, ERC20Permit {
    /// @notice Fixed supply: exactly 2,000,000,000 CT. The swap converts old CT at 0.4
    /// (set against the pre burn old supply of 5,000,000,000 CT), so this covers the whole
    /// current old supply (4,083,262,533.9560001 CT x 0.4 = about 1,633,305,013.58 CT).
    uint256 public constant TOTAL_SUPPLY = 2_000_000_000 * 10 ** 18;

    /// @param master Receives the whole supply (the founder's master wallet or a Safe).
    constructor(address master) ERC20("Cojam Token", "CT") ERC20Permit("Cojam Token") {
        // OpenZeppelin's _mint reverts with ERC20InvalidReceiver(address(0)) for the zero address.
        _mint(master, TOTAL_SUPPLY);
    }
}
