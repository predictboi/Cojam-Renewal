// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IMigration {
    function migrate(uint256 amount) external returns (uint256);
    function claim(uint256 maxLots) external returns (uint256);
    function sweep() external returns (uint256);
}

/// @notice Old token stand in that misbehaves inside transferFrom. TEST ONLY.
/// Modes:
///   0 honest
///   1 re-enter migrate and bubble the revert
///   2 re-enter claim and bubble the revert
///   3 re-enter sweep and bubble the revert
///   4 re-enter migrate inside try/catch and record whether it succeeded
///   5 credit the recipient more than `value` (inflating transfer)
///   6 move nothing but return true (lying transfer)
contract MockMaliciousToken is ERC20 {
    uint8 public mode;
    IMigration public target;
    bool public reentrySucceeded;
    bool public reentryAttempted;

    constructor(uint256 supply) ERC20("Evil CT", "ECT") {
        _mint(msg.sender, supply);
    }

    /// @dev Lets tests grow the supply past the new token's, to reach ReserveExhausted.
    function mint(address to, uint256 value) external {
        _mint(to, value);
    }

    function configure(uint8 mode_, address target_) external {
        mode = mode_;
        target = IMigration(target_);
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        if (mode == 1) {
            target.migrate(1);
        } else if (mode == 2) {
            target.claim(1);
        } else if (mode == 3) {
            target.sweep();
        } else if (mode == 4) {
            reentryAttempted = true;
            try target.migrate(1) {
                reentrySucceeded = true;
            } catch {}
        } else if (mode == 5) {
            _spendAllowance(from, msg.sender, value);
            _transfer(from, to, value);
            _mint(to, 1);
            return true;
        } else if (mode == 6) {
            return true;
        }
        return super.transferFrom(from, to, value);
    }
}
