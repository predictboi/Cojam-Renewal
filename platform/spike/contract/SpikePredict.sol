// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title SpikePredict
/// @notice Phase 0 spike contract for the Cojam Daily Prediction platform (Kairos testnet only).
/// It proves three things and nothing else:
///   1. A player (a Privy embedded wallet) authorises a local "play key" once with setPlayKey.
///   2. predict can be sent by the player itself or by the player's valid play key, and the
///      prediction is always stored for the player, never for the key.
///   3. A soulbound, ERC-20 shaped point ledger ("CJPX", 0 decimals) mints 1 point per prediction,
///      so we can see how Kaiascan shows a balance that cannot be transferred.
/// Standalone on purpose: no imports, no owner, no admin, no upgrade. Not for mainnet.
contract SpikePredict {
    // ---------------------------------------------------------------- play keys

    struct KeyBinding {
        address player; // the wallet this key plays for (0 when unbound)
        uint64 expiresAt; // unix seconds; the key is valid while block.timestamp < expiresAt
    }

    /// @notice The current play key of a player (0 when none).
    mapping(address => address) public playKeyOf;
    /// @notice Who a key plays for, and until when.
    mapping(address => KeyBinding) public keyBinding;

    // ---------------------------------------------------------------- predictions

    /// @notice choiceOf[player][marketId]: 0 = no prediction, 1 or 2 = the choice.
    mapping(address => mapping(uint256 => uint8)) public choiceOf;
    /// @notice Number of predictions stored per player.
    mapping(address => uint256) public predictionCount;

    // ---------------------------------------------------------------- soulbound point ledger (ERC-20 shaped)

    string public constant name = "Cojam Points Spike";
    string public constant symbol = "CJPX";
    uint8 public constant decimals = 0;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;

    // ---------------------------------------------------------------- events and errors

    event PlayKeySet(address indexed player, address indexed key, uint64 expiresAt, address previousKey);
    event PlayKeyRevoked(address indexed player, address indexed key);
    event Predicted(address indexed player, uint256 indexed marketId, uint8 choice, address indexed sender);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    error InvalidKey();
    error KeyInUse();
    error InvalidExpiry();
    error PlayKeyInvalid();
    error InvalidChoice();
    error AlreadyPredicted(uint256 marketId);
    error NoPlayKey();
    error Soulbound();

    uint64 public constant MAX_KEY_LIFETIME = 90 days;

    // ---------------------------------------------------------------- play key management (player only)

    /// @notice Bind `key` as the caller's play key until `expiresAt`. Replaces any earlier key.
    /// Calling it again with the same key renews the expiry.
    function setPlayKey(address key, uint64 expiresAt) external {
        if (key == address(0) || key == msg.sender) revert InvalidKey();
        // A key that plays for someone else, or an address that is itself a bound key, cannot be used.
        address owner = keyBinding[key].player;
        if (owner != address(0) && owner != msg.sender) revert KeyInUse();
        if (keyBinding[msg.sender].player != address(0)) revert InvalidKey();
        if (expiresAt <= block.timestamp || expiresAt > block.timestamp + MAX_KEY_LIFETIME) revert InvalidExpiry();

        address previous = playKeyOf[msg.sender];
        if (previous != address(0) && previous != key) delete keyBinding[previous];
        playKeyOf[msg.sender] = key;
        keyBinding[key] = KeyBinding({player: msg.sender, expiresAt: expiresAt});
        emit PlayKeySet(msg.sender, key, expiresAt, previous);
    }

    /// @notice Unbind the play key. Callable by the player or by the key itself.
    function revokePlayKey() external {
        address player;
        address key;
        if (keyBinding[msg.sender].player != address(0)) {
            key = msg.sender;
            player = keyBinding[msg.sender].player;
        } else {
            player = msg.sender;
            key = playKeyOf[msg.sender];
            if (key == address(0)) revert NoPlayKey();
        }
        delete keyBinding[key];
        delete playKeyOf[player];
        emit PlayKeyRevoked(player, key);
    }

    // ---------------------------------------------------------------- predict (player or valid play key)

    /// @notice Store one choice (1 or 2) for `marketId`. Sent by the player directly, or by the player's
    /// valid play key, in which case the prediction is stored for the player.
    function predict(uint256 marketId, uint8 choice) external {
        if (choice != 1 && choice != 2) revert InvalidChoice();
        address player = playerOf(msg.sender);
        if (choiceOf[player][marketId] != 0) revert AlreadyPredicted(marketId);
        choiceOf[player][marketId] = choice;
        unchecked {
            predictionCount[player] += 1;
            // One point per prediction; the supply cannot realistically overflow.
            totalSupply += 1;
            balanceOf[player] += 1;
        }
        emit Predicted(player, marketId, choice, msg.sender);
        emit Transfer(address(0), player, 1);
    }

    /// @notice The player a sender acts for. A bound key resolves to its player while valid and
    /// reverts with PlayKeyInvalid once expired; any other address acts for itself.
    function playerOf(address sender) public view returns (address) {
        KeyBinding memory b = keyBinding[sender];
        if (b.player == address(0)) return sender;
        if (block.timestamp >= b.expiresAt || playKeyOf[b.player] != sender) revert PlayKeyInvalid();
        return b.player;
    }

    // ---------------------------------------------------------------- ERC-20 surface: soulbound

    function allowance(address, address) external pure returns (uint256) {
        return 0;
    }

    function transfer(address, uint256) external pure returns (bool) {
        revert Soulbound();
    }

    function transferFrom(address, address, uint256) external pure returns (bool) {
        revert Soulbound();
    }

    function approve(address, uint256) external pure returns (bool) {
        revert Soulbound();
    }
}
