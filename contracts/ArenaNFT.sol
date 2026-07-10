// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

/**
 * @title ArenaNFT
 * @dev Soul-bound (non-transferable) achievement badges for Chess Arena.
 * Minted by the server (MINTER_ROLE) when a player hits a milestone. Metadata +
 * art are generated fully on-chain (data: URI), so nothing needs external hosting.
 * Testnet/demo — no value.
 */
contract ArenaNFT is ERC721, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // 0 = First Victory, 1 = Silver Champion, 2 = Gold Champion, 3 = Perfect Week
    uint8 public constant ACHIEVEMENT_COUNT = 4;

    uint256 private _nextId;
    mapping(uint256 => uint8) public tokenAchievement;
    mapping(address => mapping(uint8 => bool)) public hasAchievement;

    event AchievementMinted(address indexed player, uint256 indexed tokenId, uint8 achievement);

    constructor() ERC721("Arena Achievement", "ARENA-BADGE") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    /// @notice Mint an achievement badge to a player (once per achievement).
    function mintAchievement(address to, uint8 achievement) external onlyRole(MINTER_ROLE) returns (uint256) {
        require(achievement < ACHIEVEMENT_COUNT, "bad achievement");
        require(!hasAchievement[to][achievement], "already earned");
        uint256 id = ++_nextId;
        _safeMint(to, id);
        tokenAchievement[id] = achievement;
        hasAchievement[to][achievement] = true;
        emit AchievementMinted(to, id, achievement);
        return id;
    }

    /// @notice Which of the 4 badges a player holds.
    function getPlayerAchievements(address player) external view returns (bool[4] memory out) {
        for (uint8 i = 0; i < ACHIEVEMENT_COUNT; i++) out[i] = hasAchievement[player][i];
    }

    // ── Soul-bound: allow mint (from==0) and burn (to==0), block transfers. ──
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        require(from == address(0) || to == address(0), "Soulbound: non-transferable");
        return super._update(to, tokenId, auth);
    }

    // ── On-chain metadata + art ──
    function _name(uint8 a) internal pure returns (string memory) {
        if (a == 0) return "First Victory";
        if (a == 1) return "Silver Champion";
        if (a == 2) return "Gold Champion";
        return "Perfect Week";
    }

    function _desc(uint8 a) internal pure returns (string memory) {
        if (a == 0) return "Won your first game";
        if (a == 1) return "Won 10 games";
        if (a == 2) return "Won 100 games";
        return "Won 7 in a row";
    }

    function _color(uint8 a) internal pure returns (string memory) {
        if (a == 0) return "#cd8b52";
        if (a == 1) return "#c8c8d0";
        if (a == 2) return "#E8C040";
        return "#a78bfa";
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        uint8 a = tokenAchievement[tokenId];
        string memory color = _color(a);
        string memory name = _name(a);

        string memory svg = string(
            abi.encodePacked(
                '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">',
                '<rect width="400" height="400" fill="#0d1612"/>',
                '<circle cx="200" cy="162" r="96" fill="#141c17" stroke="', color, '" stroke-width="6"/>',
                '<text x="200" y="198" font-size="104" text-anchor="middle" fill="', color, '">&#9812;</text>',
                '<text x="200" y="312" font-size="30" text-anchor="middle" fill="#e8dcc0" font-family="serif" font-weight="bold">', name, '</text>',
                '<text x="200" y="348" font-size="15" text-anchor="middle" fill="#9a8f78">Chess Arena Achievement</text>',
                "</svg>"
            )
        );

        string memory json = string(
            abi.encodePacked(
                '{"name":"', name,
                '","description":"', _desc(a),
                ' - a soul-bound Chess Arena achievement badge (testnet).","image":"data:image/svg+xml;base64,',
                Base64.encode(bytes(svg)),
                '"}'
            )
        );

        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(json))));
    }

    function supportsInterface(bytes4 id) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(id);
    }
}
