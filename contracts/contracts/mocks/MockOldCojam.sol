// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Test stand in for the old CT on Kaia: 18 decimals, burnable, and an
/// owner that can pause all transfers or freeze single addresses (the real
/// contract exposes pause, unPause, freeze, unFreeze and lock functions).
/// TEST ONLY. Never deploy to mainnet.
contract MockOldCojam is ERC20 {
    address public immutable owner;
    bool public paused;
    mapping(address => bool) public isFrozen;

    error TokenPaused();
    error AccountFrozen(address account);
    error NotOwner();

    constructor(uint256 supply) ERC20("Cojam", "CT") {
        owner = msg.sender;
        _mint(msg.sender, supply);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function pause() external onlyOwner {
        paused = true;
    }

    function unPause() external onlyOwner {
        paused = false;
    }

    function freeze(address account) external onlyOwner {
        isFrozen[account] = true;
    }

    function unFreeze(address account) external onlyOwner {
        isFrozen[account] = false;
    }

    function burn(uint256 value) external {
        _burn(msg.sender, value);
    }

    function burnFrom(address account, uint256 value) external {
        _spendAllowance(account, msg.sender, value);
        _burn(account, value);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (paused) revert TokenPaused();
        if (from != address(0) && isFrozen[from]) revert AccountFrozen(from);
        super._update(from, to, value);
    }
}
