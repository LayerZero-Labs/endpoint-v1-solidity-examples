// SPDX-License-Identifier: MIT

pragma solidity ^0.8.2;

import "./IONFT721CoreUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";

/**
 * @dev Interface of the ONFT Upgradeable standard
 */
interface IONFT721Upgradeable is IONFT721CoreUpgradeable, IERC721Upgradeable {}
