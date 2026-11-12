// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @title Cojam Token (new CT on Kaia)
/// @notice Plain fixed supply ERC-20 (KIP-7 compatible at the ERC-20 level).
/// The whole supply is minted once, in this constructor, to `recipient`
/// (the migration contract). There is no owner, no mint after deploy,
/// no pause, no blacklist, no fee and no upgrade path.
/// @dev ERC20Permit (EIP-2612) only adds signature based approvals for holders.
contract CojamToken is ERC20, ERC20Permit {
    /// @notice Equal to the old CT supply after burns: 4,083,262,533.956 CT.
    uint256 public constant TOTAL_SUPPLY = 4_083_262_533_956 * 10 ** 15;

    constructor(address recipient) ERC20("Cojam Token", "CT") ERC20Permit("Cojam Token") {
        // OpenZeppelin's _mint already reverts with ERC20InvalidReceiver(address(0)).
        _mint(recipient, TOTAL_SUPPLY);
    }
}
