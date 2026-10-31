// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PoolKey} from "./PoolKey.sol";

/// @notice Interface for Uniswap v4 PoolManager singleton
interface IPoolManager {
    struct ModifyLiquidityParams {
        int24 tickLower;
        int24 tickUpper;
        int256 liquidityDelta;
        bytes32 salt;
    }

    struct SwapParams {
        bool zeroForOne;
        int256 amountSpecified;
        uint160 sqrtPriceLimitX96;
    }

    function initialize(PoolKey memory key, uint160 sqrtPriceX96) external returns (int24 tick);

    function unlock(bytes calldata data) external returns (bytes memory);

    function modifyLiquidity(
        PoolKey memory key,
        ModifyLiquidityParams memory params,
        bytes calldata hookData
    ) external returns (int256 callerDelta, int256 feesAccrued);

    function sync(address currency) external;

    function settle() external payable returns (uint256 paid);

    function take(address currency, address to, uint256 amount) external;
}

interface IUnlockCallback {
    function unlockCallback(bytes calldata data) external returns (bytes memory);
}
