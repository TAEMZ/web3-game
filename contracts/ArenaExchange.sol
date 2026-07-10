// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

interface IMintableBurnable is IERC20 {
    function mint(address to, uint256 amount) external;
    function burn(uint256 amount) external;
}

/**
 * @title ArenaExchange
 * @dev Swaps testnet USDC (6 decimals) <-> ARENA (18 decimals) at a fixed, admin-settable rate.
 * Testnet demo only. On buy it MINTS ARENA to the player; on sell it MINTS USDC back — both are
 * freely-minted demo coins, so the exchange never runs dry. The exchange must hold MINTER_ROLE
 * on both TestUSD and ArenaToken (granted at deploy time).
 */
contract ArenaExchange is AccessControl {
    IMintableBurnable public immutable usd;    // TestUSD, 6 decimals
    IMintableBurnable public immutable arena;  // ArenaToken, 18 decimals

    /// @dev ARENA (whole tokens) received per 1 whole USDC. e.g. 100 => 1 USDC buys 100 ARENA (ARENA = $0.01).
    uint256 public rate;

    /// @dev 1e18 / 1e6 — the decimal gap between ARENA (18) and USDC (6).
    uint256 private constant DECIMAL_GAP = 1e12;

    event BoughtArena(address indexed buyer, uint256 usdcIn, uint256 arenaOut);
    event SoldArena(address indexed seller, uint256 arenaIn, uint256 usdcOut);
    event RateChanged(uint256 rate);

    constructor(address _usd, address _arena, uint256 _rate) {
        require(_rate > 0, "rate=0");
        usd = IMintableBurnable(_usd);
        arena = IMintableBurnable(_arena);
        rate = _rate;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function setRate(uint256 _rate) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_rate > 0, "rate=0");
        rate = _rate;
        emit RateChanged(_rate);
    }

    /// @notice Buy ARENA with USDC. Caller must approve `usdcAmount` (6-dec units) to this contract first.
    function buyArena(uint256 usdcAmount) external {
        require(usdcAmount > 0, "amount=0");
        require(usd.transferFrom(msg.sender, address(this), usdcAmount), "USDC pull failed");
        uint256 arenaOut = usdcAmount * rate * DECIMAL_GAP;
        arena.mint(msg.sender, arenaOut);
        emit BoughtArena(msg.sender, usdcAmount, arenaOut);
    }

    /// @notice Sell ARENA back for USDC. Caller must approve `arenaAmount` (18-dec units) to this contract first.
    function sellArena(uint256 arenaAmount) external {
        require(arenaAmount > 0, "amount=0");
        uint256 usdcOut = arenaAmount / (rate * DECIMAL_GAP);
        require(usdcOut > 0, "dust: below 1 USDC unit");
        require(arena.transferFrom(msg.sender, address(this), arenaAmount), "ARENA pull failed");
        arena.burn(arenaAmount); // burn the ARENA we just took (from our own balance)
        usd.mint(msg.sender, usdcOut);
        emit SoldArena(msg.sender, arenaAmount, usdcOut);
    }

    // --- view quotes for the UI ---
    function arenaForUsdc(uint256 usdcAmount) external view returns (uint256) {
        return usdcAmount * rate * DECIMAL_GAP;
    }

    function usdcForArena(uint256 arenaAmount) external view returns (uint256) {
        return arenaAmount / (rate * DECIMAL_GAP);
    }
}
