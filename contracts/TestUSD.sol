// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title TestUSD
 * @dev Testnet-only mock USD stablecoin (6 decimals, like real USDC) for the Chess Arena demo.
 * Freely minted by the treasury and dripped to players on sign-in. This is NOT real money
 * and has no value — it exists purely so "dollars" are a real coin in the wallet on testnet.
 */
contract TestUSD is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor() ERC20("Test USD", "USDC") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    /// @dev USDC uses 6 decimals (not the default 18).
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @dev Mint demo USD to a player (treasury on sign-in, or the exchange on sell-back).
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    /// @dev Burn your own USD.
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
