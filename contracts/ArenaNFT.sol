// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title ArenaNFT
 * @dev NFT badges for Chess Arena achievements
 * Non-transferable soul-bound tokens representing achievements
 */
contract ArenaNFT is ERC721, AccessControl {
    using Counters for Counters.Counter;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    
    Counters.Counter private _tokenIds;

    // Achievement types
    enum Achievement {
        FIRST_WIN,      // ID: 0
        TEN_WINS,       // ID: 1
        HUNDRED_WINS,   // ID: 2
        PERFECT_WEEK    // ID: 3
    }

    // Token ID => Achievement type
    mapping(uint256 => Achievement) public tokenAchievement;
    
    // Token ID => Game ID (for provenance)
    mapping(uint256 => uint256) public tokenGameId;
    
    // Wallet => Achievement => Has earned
    mapping(address => mapping(Achievement => bool)) public hasAchievement;

    // Base URI for metadata
    string private _baseTokenURI;

    event AchievementMinted(
        address indexed player,
        uint256 indexed tokenId,
        Achievement achievement,
        uint256 gameId
    );

    constructor() ERC721("Arena Achievement", "ARENA-BADGE") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    /**
     * @dev Mint achievement NFT to player
     * @param to Player's wallet address
     * @param achievement Achievement type
     * @param gameId Game ID that triggered the achievement
     */
    function mintAchievement(
        address to,
        Achievement achievement,
        uint256 gameId
    ) external onlyRole(MINTER_ROLE) returns (uint256) {
        require(!hasAchievement[to][achievement], "Achievement already earned");
        
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();

        _safeMint(to, newTokenId);
        
        tokenAchievement[newTokenId] = achievement;
        tokenGameId[newTokenId] = gameId;
        hasAchievement[to][achievement] = true;

        emit AchievementMinted(to, newTokenId, achievement, gameId);

        return newTokenId;
    }

    /**
     * @dev Override transfer to make NFTs soul-bound (non-transferable)
     */
    function _transfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override {
        require(from == address(0), "Achievement NFTs are soul-bound");
        super._transfer(from, to, tokenId);
    }

    /**
     * @dev Get all achievements earned by a player
     * @param player Player's wallet address
     */
    function getPlayerAchievements(address player) 
        external 
        view 
        returns (bool[4] memory) 
    {
        return [
            hasAchievement[player][Achievement.FIRST_WIN],
            hasAchievement[player][Achievement.TEN_WINS],
            hasAchievement[player][Achievement.HUNDRED_WINS],
            hasAchievement[player][Achievement.PERFECT_WEEK]
        ];
    }

    /**
     * @dev Set base URI for token metadata
     */
    function setBaseURI(string memory baseURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _baseTokenURI = baseURI;
    }

    /**
     * @dev Get base URI
     */
    function _baseURI() internal view virtual override returns (string memory) {
        return _baseTokenURI;
    }

    /**
     * @dev See {IERC165-supportsInterface}
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
