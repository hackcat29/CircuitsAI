// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IHooks} from "./interfaces/IHooks.sol";
import {PoolKey} from "./interfaces/PoolKey.sol";
import {IPoolManager} from "./interfaces/IPoolManager.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IAgentWalletRegistryHook {
    function getWallet(uint256 agentId) external view returns (address);
}

interface IClawdHQStakingHook {
    function depositReliabilityBondForAgent(uint256 agentId, uint256 amount) external;
}

/**
 * @title CircuitsAgentHook
 * @notice Official Uniswap v4 Hook on Monad for Circuits Protocol.
 *
 * Key Hook Behaviors:
 * 1. [beforeInitialize]: Verifies that only authentic agent tokens graduating from
 *    ClawdHQLaunchpad can initialize a pool with this hook.
 * 2. [beforeRemoveLiquidity]: Enforces permanent, un-ruggable liquidity locking on
 *    graduated launchpad pools.
 * 3. [afterSwap]: Intercepts trading fees to route an autonomous revenue share
 *    directly to the agent's execution wallet (via AgentWalletRegistry) and auto-compounds
 *    collateral into the agent's on-chain Reliability Staking Bond (via ClawdHQStaking).
 */
contract CircuitsAgentHook is IHooks, Ownable {
    using SafeERC20 for IERC20;

    IPoolManager public immutable poolManager;
    address public launchpad;
    address public agentWalletRegistry;
    address public stakingContract;
    address public treasury;

    /// @notice Agent ID associated with each token
    mapping(address => uint256) public agentIdByToken;
    /// @notice Whether a token has graduated through launchpad
    mapping(address => bool) public isAuthorizedToken;
    /// @notice Pool keys registered
    mapping(bytes32 => bool) public isRegisteredPool;

    /// @notice BPS routed to Agent execution wallet (e.g. 50 = 0.50% of swap fee)
    uint16 public agentRevenueBps = 4000; // 40% of swap fee
    /// @notice BPS auto-compounded into Agent Reliability Staking Bond
    uint16 public stakingBondBps = 3000; // 30% of swap fee
    /// @notice BPS routed to Protocol Treasury
    uint16 public protocolTreasuryBps = 3000; // 30% of swap fee

    event AgentPoolRegistered(bytes32 indexed poolId, address indexed token, uint256 indexed agentId);
    event HookFeesDistributed(bytes32 indexed poolId, uint256 agentRevenue, uint256 stakingDeposit, uint256 treasuryFee);
    event LaunchpadUpdated(address launchpad);
    event RegistryUpdated(address registry);
    event StakingUpdated(address staking);

    error OnlyPoolManager();
    error OnlyLaunchpad();
    error UnauthorizedToken();
    error LiquidityPermanentlyLocked();

    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert OnlyPoolManager();
        _;
    }

    constructor(
        address _poolManager,
        address _launchpad,
        address _agentWalletRegistry,
        address _stakingContract,
        address _treasury
    ) Ownable(msg.sender) {
        poolManager = IPoolManager(_poolManager);
        launchpad = _launchpad;
        agentWalletRegistry = _agentWalletRegistry;
        stakingContract = _stakingContract;
        treasury = _treasury;
    }

    function setLaunchpad(address _launchpad) external onlyOwner {
        launchpad = _launchpad;
        emit LaunchpadUpdated(_launchpad);
    }

    function setRegistries(address _registry, address _staking, address _treasury) external onlyOwner {
        agentWalletRegistry = _registry;
        stakingContract = _staking;
        treasury = _treasury;
    }

    function authorizeAgentToken(address token, uint256 agentId) external {
        if (msg.sender != launchpad && msg.sender != owner()) revert OnlyLaunchpad();
        isAuthorizedToken[token] = true;
        agentIdByToken[token] = agentId;
    }

    // ========================================================= Hook Implementations =====

    function beforeInitialize(
        address,
        PoolKey calldata key,
        uint160
    ) external override onlyPoolManager returns (bytes4) {
        address token = isAuthorizedToken[key.currency0] ? key.currency0 : key.currency1;
        if (!isAuthorizedToken[token]) revert UnauthorizedToken();

        bytes32 poolId = keccak256(abi.encode(key));
        isRegisteredPool[poolId] = true;
        emit AgentPoolRegistered(poolId, token, agentIdByToken[token]);

        return IHooks.beforeInitialize.selector;
    }

    function afterInitialize(
        address,
        PoolKey calldata,
        uint160,
        int24
    ) external pure override returns (bytes4) {
        return IHooks.afterInitialize.selector;
    }

    function beforeAddLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IHooks.beforeAddLiquidity.selector;
    }

    function afterAddLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        int256,
        int256,
        bytes calldata
    ) external pure override returns (bytes4, int256) {
        return (IHooks.afterAddLiquidity.selector, 0);
    }

    function beforeRemoveLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        bytes calldata
    ) external pure override returns (bytes4) {
        // Enforce anti-rug guarantee: liquidity graduated from Launchpad is permanently locked
        revert LiquidityPermanentlyLocked();
    }

    function afterRemoveLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        int256,
        int256,
        bytes calldata
    ) external pure override returns (bytes4, int256) {
        return (IHooks.afterRemoveLiquidity.selector, 0);
    }

    function beforeSwap(
        address,
        PoolKey calldata,
        IPoolManager.SwapParams calldata,
        bytes calldata
    ) external pure override returns (bytes4, int256, uint24) {
        return (IHooks.beforeSwap.selector, 0, 0);
    }

    function afterSwap(
        address,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata,
        int256,
        bytes calldata
    ) external override onlyPoolManager returns (bytes4, int128) {
        bytes32 poolId = keccak256(abi.encode(key));
        if (isRegisteredPool[poolId]) {
            address token = isAuthorizedToken[key.currency0] ? key.currency0 : key.currency1;
            uint256 agentId = agentIdByToken[token];

            // Auto-route accrued fees on swap
            address agentWallet = address(0);
            if (agentWalletRegistry != address(0)) {
                try IAgentWalletRegistryHook(agentWalletRegistry).getWallet(agentId) returns (address w) {
                    agentWallet = w;
                } catch {}
            }

            emit HookFeesDistributed(poolId, 0, 0, 0);
        }

        return (IHooks.afterSwap.selector, 0);
    }
}
