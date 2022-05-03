// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./IOFTCore.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @dev Interface of the OFT standard
 */
interface IOFT is IOFTCore, IERC20 {
    // /**
    //  * @dev returns the type of OFT
    //  */
    // function getType() external returns (uint);
    // /**
    //  * @dev returns the total amount of tokens across all chains
    //  */
    // function getGlobalSupply() external returns (uint);
}
