// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../token/oft/v2/OFTV2.sol";

contract OFTV2MintableMock is OFTV2 {
    constructor(string memory _name, string memory _symbol, uint8 _sharedDecimals, address _layerZeroEndpoint) OFTV2(_name, _symbol, _sharedDecimals, _layerZeroEndpoint) {}

    function mint(address _to, uint _amount) public {
        _mint(_to, _amount);
    }
}