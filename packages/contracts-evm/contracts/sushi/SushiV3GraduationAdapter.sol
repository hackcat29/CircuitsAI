// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

interface ISushiV3NonfungiblePositionManager {
    struct MintParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }

    function createAndInitializePoolIfNecessary(
        address token0,
        address token1,
        uint24 fee,
        uint160 sqrtPriceX96
    ) external payable returns (address pool);

    function mint(MintParams calldata params)
        external
        payable
        returns (
            uint256 tokenId,
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        );

    function factory() external view returns (address);
}

/**
 * @title SushiV3GraduationAdapter
 * @notice Drop-in adapter implementing IUniswapV2Router02.addLiquidity for ClawdHQLaunchpad
 * to graduate tokens into Sushi V3 concentrated liquidity on Arc Mainnet.
 * Mints full-range liquidity (ticks [-887220, 887220] for 0.30% fee tier) and locks the position
 * NFT to BURN_ADDRESS permanently.
 */
contract SushiV3GraduationAdapter is Ownable {
    using SafeERC20 for IERC20;

    ISushiV3NonfungiblePositionManager public positionManager;
    uint24 public feeTier; // default 3000 (0.30%)

    // For fee tier 3000, tick spacing is 60.
    // Full-range ticks divisible by 60 are [-887220, 887220].
    int24 public constant FULL_RANGE_TICK_LOWER = -887220;
    int24 public constant FULL_RANGE_TICK_UPPER = 887220;

    event GraduatedToSushiV3(
        address indexed tokenA,
        address indexed tokenB,
        address indexed pool,
        uint256 tokenId,
        uint128 liquidity,
        uint256 amount0,
        uint256 amount1
    );

    event PositionManagerUpdated(address newPositionManager);
    event FeeTierUpdated(uint24 newFeeTier);

    constructor(address _positionManager, uint24 _feeTier) Ownable(msg.sender) {
        positionManager = ISushiV3NonfungiblePositionManager(_positionManager);
        feeTier = _feeTier > 0 ? _feeTier : 3000;
    }

    function setPositionManager(address newPositionManager) external onlyOwner {
        require(newPositionManager != address(0), "ZeroAddress");
        positionManager = ISushiV3NonfungiblePositionManager(newPositionManager);
        emit PositionManagerUpdated(newPositionManager);
    }

    function setFeeTier(uint24 newFeeTier) external onlyOwner {
        require(newFeeTier > 0, "InvalidFeeTier");
        feeTier = newFeeTier;
        emit FeeTierUpdated(newFeeTier);
    }

    /// @notice Drops in as IUniswapV2Router02.addLiquidity so ClawdHQLaunchpad can migrate to Sushi V3 seamlessly.
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256,
        uint256,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        require(address(positionManager) != address(0), "PositionManagerNotConfigured");

        // Transfer tokens from caller (ClawdHQLaunchpad)
        IERC20(tokenA).safeTransferFrom(msg.sender, address(this), amountADesired);
        IERC20(tokenB).safeTransferFrom(msg.sender, address(this), amountBDesired);

        // Sort tokens as required by V3
        (address token0, address token1, uint256 amount0, uint256 amount1) = tokenA < tokenB
            ? (tokenA, tokenB, amountADesired, amountBDesired)
            : (tokenB, tokenA, amountBDesired, amountADesired);

        // Compute sqrtPriceX96 = sqrt(amount1 / amount0) * 2^96 in Q64.96 format
        uint160 sqrtPriceX96 = _computeSqrtPriceX96(amount0, amount1);

        // Initialize pool if necessary
        address pool = positionManager.createAndInitializePoolIfNecessary(token0, token1, feeTier, sqrtPriceX96);

        // Approve position manager
        IERC20(token0).forceApprove(address(positionManager), amount0);
        IERC20(token1).forceApprove(address(positionManager), amount1);

        // Mint full-range position to recipient (e.g. BURN_ADDRESS)
        ISushiV3NonfungiblePositionManager.MintParams memory params = ISushiV3NonfungiblePositionManager.MintParams({
            token0: token0,
            token1: token1,
            fee: feeTier,
            tickLower: FULL_RANGE_TICK_LOWER,
            tickUpper: FULL_RANGE_TICK_UPPER,
            amount0Desired: amount0,
            amount1Desired: amount1,
            amount0Min: 0,
            amount1Min: 0,
            recipient: to,
            deadline: deadline
        });

        (uint256 tokenId, uint128 liq, uint256 actual0, uint256 actual1) = positionManager.mint(params);

        // Sweep any unspent dust to recipient
        if (amount0 > actual0) {
            IERC20(token0).safeTransfer(to, amount0 - actual0);
        }
        if (amount1 > actual1) {
            IERC20(token1).safeTransfer(to, amount1 - actual1);
        }

        emit GraduatedToSushiV3(tokenA, tokenB, pool, tokenId, liq, actual0, actual1);

        return (amountADesired, amountBDesired, uint256(liq));
    }

    function _computeSqrtPriceX96(uint256 amount0, uint256 amount1) internal pure returns (uint160) {
        require(amount0 > 0 && amount1 > 0, "ZeroAmounts");
        // ratioX192 = (amount1 * 2^192) / amount0
        uint256 ratioX192 = Math.mulDiv(amount1, uint256(1) << 192, amount0);
        return uint160(Math.sqrt(ratioX192));
    }
}
