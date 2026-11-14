// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Minimal contract wallet (stand in for a Safe): an owner executes calls,
/// one at a time or as an atomic batch (like Safe MultiSend). TEST ONLY.
contract MockSmartWallet {
    address public immutable owner;

    error NotOwner();
    error CallFailed(uint256 index, bytes reason);

    constructor(address owner_) {
        owner = owner_;
    }

    function execute(address target, bytes calldata data) external returns (bytes memory) {
        if (msg.sender != owner) revert NotOwner();
        (bool ok, bytes memory ret) = target.call(data);
        if (!ok) revert CallFailed(0, ret);
        return ret;
    }

    function executeBatch(address[] calldata targets, bytes[] calldata data) external {
        if (msg.sender != owner) revert NotOwner();
        for (uint256 i = 0; i < targets.length; ++i) {
            (bool ok, bytes memory ret) = targets[i].call(data[i]);
            if (!ok) revert CallFailed(i, ret);
        }
    }
}
