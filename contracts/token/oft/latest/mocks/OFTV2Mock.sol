// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../OFTV2.sol";

// @dev mock OFTV2 demonstrating how to inherit OFTV2
contract OFTV2Mock is OFTV2 {
    constructor(address _layerZeroEndpoint, uint _initialSupply, uint8 _sharedDecimals) OFTV2("ExampleOFT", "OFT", _sharedDecimals, _layerZeroEndpoint) {
        _mint(_msgSender(), _initialSupply);
    }
}
