// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IStakingTarget {
    function stake(uint256 amount, uint8 lockIndex) external returns (uint256);
    function claimInterest(uint256 id) external returns (uint256);
    function withdraw(uint256 id) external returns (uint256, uint256);
    function withdrawRewards(uint256 amount, address to) external;
}

/// @notice CT stand in that misbehaves inside transfers. TEST ONLY.
/// Re-entry modes act on the next `transferFrom` (a pull) or `transfer` (a payout):
///   0 honest
///   1 re-enter stake            2 re-enter claimInterest(0)
///   3 re-enter withdraw(0)      4 re-enter withdrawRewards(1, treasury)
///   5 credit the recipient more than `value` on transferFrom (inflating pull)
///   6 move nothing on transferFrom but return true (lying pull)
/// The re-entering call is made by this token contract; it bubbles the revert.
/// With `swallow` set, a failed re-entry is caught and recorded instead.
contract StakingEvilToken is ERC20 {
    uint8 public mode;
    bool public onPayout;
    bool public swallow;
    IStakingTarget public target;
    address public treasuryArg;
    bool public reentryAttempted;
    bool public reentrySucceeded;

    constructor(uint256 supply) ERC20("Evil CT", "ECT") {
        _mint(msg.sender, supply);
    }

    function configure(uint8 mode_, bool onPayout_, bool swallow_, address target_, address treasury_) external {
        mode = mode_;
        onPayout = onPayout_;
        swallow = swallow_;
        target = IStakingTarget(target_);
        treasuryArg = treasury_;
        // The token itself is the re-entering caller: give it CT and an approve for `stake`.
        _mint(address(this), 1_000e18);
        _approve(address(this), target_, type(uint256).max);
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        if (!onPayout) {
            if (mode == 5) {
                _spendAllowance(from, msg.sender, value);
                _transfer(from, to, value);
                _mint(to, 1);
                return true;
            }
            if (mode == 6) return true;
            _reenter();
        }
        return super.transferFrom(from, to, value);
    }

    function transfer(address to, uint256 value) public override returns (bool) {
        if (onPayout) _reenter();
        return super.transfer(to, value);
    }

    function _reenter() private {
        if (mode == 0 || mode > 4) return;
        uint8 m = mode;
        mode = 0; // one attempt only
        reentryAttempted = true;
        if (swallow) {
            try this.callTarget(m) {
                reentrySucceeded = true;
            } catch {}
        } else {
            this.callTarget(m);
        }
    }

    /// @dev External so `try` can catch it; only this token calls it.
    function callTarget(uint8 m) external {
        require(msg.sender == address(this), "self only");
        if (m == 1) target.stake(100e18, 0);
        else if (m == 2) target.claimInterest(0);
        else if (m == 3) target.withdraw(0);
        else if (m == 4) target.withdrawRewards(1, treasuryArg);
    }
}
