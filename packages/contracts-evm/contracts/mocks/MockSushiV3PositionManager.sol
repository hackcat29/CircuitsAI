// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockSushiV3PositionManager {
    using SafeERC20 for IERC20;

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

    struct Position {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
        address recipient;
    }

    uint256 public nextTokenId = 1;
    mapping(uint256 => Position) public positions;
    mapping(bytes32 => address) public pools;
    mapping(address => uint256) public positionBalanceOf;
    address public factory;

    event PoolCreated(address indexed token0, address indexed token1, uint24 fee, address pool, uint160 sqrtPriceX96);
    event PositionMinted(uint256 indexed tokenId, address indexed recipient, uint128 liquidity);

    constructor() {
        factory = address(this);
    }

    function createAndInitializePoolIfNecessary(
        address token0,
        address token1,
        uint24 fee,
        uint160 sqrtPriceX96
    ) external returns (address pool) {
        bytes32 key = keccak256(abi.encodePacked(token0, token1, fee));
        pool = pools[key];
        if (pool == address(0)) {
            // Deterministic mock pool address
            pool = address(uint160(uint256(keccak256(abi.encodePacked(key, block.timestamp)))));
            pools[key] = pool;
            emit PoolCreated(token0, token1, fee, pool, sqrtPriceX96);
        }
    }

    function mint(MintParams calldata params)
        external
        returns (
            uint256 tokenId,
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        )
    {
        require(params.amount0Desired > 0 && params.amount1Desired > 0, "ZeroAmounts");
        require(params.recipient != address(0), "ZeroRecipient");

        IERC20(params.token0).safeTransferFrom(msg.sender, address(this), params.amount0Desired);
        IERC20(params.token1).safeTransferFrom(msg.sender, address(this), params.amount1Desired);

        tokenId = nextTokenId++;
        liquidity = uint128(params.amount0Desired / 2 + params.amount1Desired / 2);

        positions[tokenId] = Position({
            token0: params.token0,
            token1: params.token1,
            fee: params.fee,
            tickLower: params.tickLower,
            tickUpper: params.tickUpper,
            liquidity: liquidity,
            recipient: params.recipient
        });

        positionBalanceOf[params.recipient]++;

        emit PositionMinted(tokenId, params.recipient, liquidity);

        return (tokenId, liquidity, params.amount0Desired, params.amount1Desired);
    }
}
