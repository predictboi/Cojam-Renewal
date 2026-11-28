// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {CojamStaking} from "../platform/CojamStaking.sol";

/// @notice CojamStaking with every lock day shortened to `secondsPerDay` seconds, for
/// live full cycle tests on Kairos. TEST ONLY: never deploy to mainnet.
contract StakingShortLock is CojamStaking {
    uint256 public immutable SECONDS_PER_DAY;

    constructor(IERC20 ct, address owner_, address treasury_, address pauser, uint256 secondsPerDay)
        CojamStaking(ct, owner_, treasury_, pauser)
    {
        SECONDS_PER_DAY = secondsPerDay;
    }

    function _lockDuration(uint256 lockIndex) internal view override returns (uint256) {
        return lockDays(lockIndex) * SECONDS_PER_DAY;
    }
}
