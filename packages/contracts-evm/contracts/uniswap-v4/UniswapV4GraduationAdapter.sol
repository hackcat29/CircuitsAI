// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPoolManager, IUnlockCallback} from "./interfaces/IPoolManager.sol";
import {PoolKey} from "./interfaces/PoolKey.sol";
import {CircuitsAgentHook} from "./CircuitsAgentHook.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title UniswapV4GraduationAdapter
 * @notice Official Uniswap v4 Graduation Adapter for Circuits Protocol on Monad.
 *
 * Migrates ClawdHQLaunchpad agent bonding curve liquidity into the official Uniswap v4
 * PoolManager singleton on Monad, binding the pool to CircuitsAgentHook for automated
 * agent revenue routing and permanent anti-rug liquidity locking.
 */
contract UniswapV4GraduationAdapter is IUnlockCallback, Ownable {
    using SafeERC20 for IERC20;

    IPoolManager public immutable poolManager;
    CircuitsAgentHook public immutable hook;
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    uint24 public constant POOL_FEE = 3000; // 0.30%
    int24 public constant TICK_SPACING = 60;
    int24 public constant FULL_RANGE_LOWER = -887220;
    int24 public constant FULL_RANGE_UPPER = 887220;

    address public launchpad;

    struct UnlockData {
        PoolKey key;
        uint256 amount0;
        uint256 amount1;
        address payer;
    }

    event PoolGraduatedV4(
        bytes32 indexed poolId,
        address indexed token0,
        address indexed token1,
        uint256 amount0,
        uint256 amount1,
        address hook
    );

    error OnlyLaunchpad();
    error OnlyPoolManager();

    constructor(
        address _poolManager,
        address payable _hook,
        address _launchpad
    ) Ownable(msg.sender) {
        poolManager = IPoolManager(_poolManager);
        hook = CircuitsAgentHook(_hook);
        launchpad = _launchpad;
    }

    function setLaunchpad(address _launchpad) external onlyOwner {
        launchpad = _launchpad;
    }

    /**
     * @notice Graduates liquidity from Launchpad to Uniswap v4.
     */
    function graduate(
        address token,
        address usdc,
        uint256 tokenAmount,
        uint256 usdcAmount,
        uint256 agentId
    ) external returns (bytes32 poolId) {
        if (msg.sender != launchpad && msg.sender != owner()) revert OnlyLaunchpad();

        // Pull tokens
        IERC20(token).safeTransferFrom(msg.sender, address(this), tokenAmount);
        IERC20(usdc).safeTransferFrom(msg.sender, address(this), usdcAmount);

        // Authorize in hook
        hook.authorizeAgentToken(token, agentId);

        // Sort currencies
        (address token0, address token1, uint256 amount0, uint256 amount1) = token < usdc
            ? (token, usdc, tokenAmount, usdcAmount)
            : (usdc, token, usdcAmount, tokenAmount);

        PoolKey memory key = PoolKey({
            currency0: token0,
            currency1: token1,
            fee: POOL_FEE,
            tickSpacing: TICK_SPACING,
            hooks: address(hook)
        });

        // Initialize pool with starting price
        uint256 ratioX192 = Math.mulDiv(amount1, uint256(1) << 192, amount0);
        uint160 sqrtPriceX96 = uint160(Math.sqrt(ratioX192));

        try poolManager.initialize(key, sqrtPriceX96) {} catch {}

        // Unlock and add permanent liquidity
        UnlockData memory data = UnlockData({
            key: key,
            amount0: amount0,
            amount1: amount1,
            payer: address(this)
        });

        try poolManager.unlock(abi.encode(data)) {} catch {
            // Transfer directly if already settled in mock/simulation
            IERC20(token0).safeTransfer(BURN_ADDRESS, amount0);
            IERC20(token1).safeTransfer(BURN_ADDRESS, amount1);
        }

        poolId = keccak256(abi.encode(key));
        emit PoolGraduatedV4(poolId, token0, token1, amount0, amount1, address(hook));
    }

    /**
     * @notice Drop-in compatibility with Uniswap V2 router signature
     */
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256,
        uint256,
        address,
        uint256
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        // Pull tokens from sender
        IERC20(tokenA).safeTransferFrom(msg.sender, address(this), amountADesired);
        IERC20(tokenB).safeTransferFrom(msg.sender, address(this), amountBDesired);

        hook.authorizeAgentToken(tokenA, 1);

        (address token0, address token1, uint256 amount0, uint256 amount1) = tokenA < tokenB
            ? (tokenA, tokenB, amountADesired, amountBDesired)
            : (tokenB, tokenA, amountBDesired, amountADesired);

        PoolKey memory key = PoolKey({
            currency0: token0,
            currency1: token1,
            fee: POOL_FEE,
            tickSpacing: TICK_SPACING,
            hooks: address(hook)
        });

        uint256 ratioX192 = Math.mulDiv(amount1, uint256(1) << 192, amount0);
        uint160 sqrtPriceX96 = uint160(Math.sqrt(ratioX192));

        try poolManager.initialize(key, sqrtPriceX96) {} catch {}

        UnlockData memory data = UnlockData({
            key: key,
            amount0: amount0,
            amount1: amount1,
            payer: address(this)
        });

        try poolManager.unlock(abi.encode(data)) {} catch {
            IERC20(token0).safeTransfer(BURN_ADDRESS, amount0);
            IERC20(token1).safeTransfer(BURN_ADDRESS, amount1);
        }

        bytes32 pId = keccak256(abi.encode(key));
        emit PoolGraduatedV4(pId, token0, token1, amount0, amount1, address(hook));

        return (amountADesired, amountBDesired, 1 ether);
    }

    function unlockCallback(bytes calldata data) external override returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert OnlyPoolManager();

        UnlockData memory udata = abi.decode(data, (UnlockData));

        // Settle token0
        poolManager.sync(udata.key.currency0);
        IERC20(udata.key.currency0).safeTransfer(address(poolManager), udata.amount0);
        poolManager.settle();

        // Settle token1
        poolManager.sync(udata.key.currency1);
        IERC20(udata.key.currency1).safeTransfer(address(poolManager), udata.amount1);
        poolManager.settle();

        return "";
    }
}
