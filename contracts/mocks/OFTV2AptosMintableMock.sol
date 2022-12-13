// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../token/oft/v2/aptos/OFTV2Aptos.sol";

contract OFTV2AptosMintableMock is OFTV2Aptos {
    constructor(string memory _name, string memory _symbol, uint8 _sharedDecimals, address _layerZeroEndpoint) OFTV2Aptos(_name, _symbol, _sharedDecimals, _layerZeroEndpoint) {}

    function mint(address _to, uint _amount) public {
        _mint(_to, _amount);
    }
}