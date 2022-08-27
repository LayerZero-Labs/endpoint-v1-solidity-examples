// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import "./IONFT721Core.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @dev Interface of the ONFT standard
 */
interface IONFT721 is IONFT721Core, IERC721 {

}
