// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Uniswap v4 PoolKey identifier
struct PoolKey {
    address currency0;
    address currency1;
    uint24 fee;
    int24 tickSpacing;
    address hooks;
}

library PoolIdLibrary {
    function toId(PoolKey memory poolKey) internal pure returns (bytes32) {
        return keccak256(abi.encode(poolKey));
    }
}
