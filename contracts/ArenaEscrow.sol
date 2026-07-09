// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ArenaEscrow
 * @dev Wager matches for Chess Arena. Two players each stake the same amount of
 *      ARENA tokens; the winner takes the pot. Results are reported by an
 *      account holding SETTLER_ROLE (the game server, gated behind admin
 *      verification). Draws refund both players.
 *
 * Flow:
 *   1. player1 approves this contract for `stake` ARENA, then createMatch(stake)
 *   2. player2 approves for the same `stake`, then joinMatch(id)
 *   3. after the chess game ends, the server (SETTLER_ROLE) calls
 *      settleMatch(id, winner) — or settleDraw(id) — to release funds
 *   4. an OPEN match nobody joined can be cancelled (refund to player1)
 */
contract ArenaEscrow is AccessControl, ReentrancyGuard {
    bytes32 public constant SETTLER_ROLE = keccak256("SETTLER_ROLE");

    IERC20 public immutable token;

    enum State { NONE, OPEN, FUNDED, SETTLED, CANCELLED }

    struct Match {
        address player1;
        address player2;
        uint256 stake;
        State state;
    }

    uint256 public nextMatchId = 1;
    mapping(uint256 => Match) public matches;

    event MatchCreated(uint256 indexed id, address indexed player1, uint256 stake);
    event MatchJoined(uint256 indexed id, address indexed player2);
    event MatchSettled(uint256 indexed id, address indexed winner, uint256 payout);
    event MatchCancelled(uint256 indexed id);

    constructor(address tokenAddress) {
        require(tokenAddress != address(0), "token=0");
        token = IERC20(tokenAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(SETTLER_ROLE, msg.sender);
    }

    function createMatch(uint256 stake) external nonReentrant returns (uint256 id) {
        require(stake > 0, "stake=0");
        require(token.transferFrom(msg.sender, address(this), stake), "stake transfer failed");
        id = nextMatchId++;
        matches[id] = Match({ player1: msg.sender, player2: address(0), stake: stake, state: State.OPEN });
        emit MatchCreated(id, msg.sender, stake);
    }

    function joinMatch(uint256 id) external nonReentrant {
        Match storage m = matches[id];
        require(m.state == State.OPEN, "not open");
        require(m.player1 != msg.sender, "cannot join own match");
        require(token.transferFrom(msg.sender, address(this), m.stake), "stake transfer failed");
        m.player2 = msg.sender;
        m.state = State.FUNDED;
        emit MatchJoined(id, msg.sender);
    }

    /// @dev Server reports the winner after admin verification.
    function settleMatch(uint256 id, address winner) external onlyRole(SETTLER_ROLE) nonReentrant {
        Match storage m = matches[id];
        require(m.state == State.FUNDED, "not funded");
        require(winner == m.player1 || winner == m.player2, "winner not in match");
        m.state = State.SETTLED;
        uint256 pot = m.stake * 2;
        require(token.transfer(winner, pot), "payout failed");
        emit MatchSettled(id, winner, pot);
    }

    /// @dev Draw: refund both players their stake.
    function settleDraw(uint256 id) external onlyRole(SETTLER_ROLE) nonReentrant {
        Match storage m = matches[id];
        require(m.state == State.FUNDED, "not funded");
        m.state = State.SETTLED;
        require(token.transfer(m.player1, m.stake), "refund p1 failed");
        require(token.transfer(m.player2, m.stake), "refund p2 failed");
        emit MatchSettled(id, address(0), 0);
    }

    /// @dev An OPEN (unjoined) match can be cancelled by its creator or a settler.
    function cancelMatch(uint256 id) external nonReentrant {
        Match storage m = matches[id];
        require(m.state == State.OPEN, "not open");
        require(m.player1 == msg.sender || hasRole(SETTLER_ROLE, msg.sender), "not allowed");
        m.state = State.CANCELLED;
        require(token.transfer(m.player1, m.stake), "refund failed");
        emit MatchCancelled(id);
    }

    function getMatch(uint256 id) external view returns (Match memory) {
        return matches[id];
    }
}
