// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8;

import "../token/onft/ONFT721.sol";

contract ONFT721Mock is ONFT721 {
    constructor(string memory _name, string memory _symbol, address _layerZeroEndpoint) ONFT721(_name, _symbol, _layerZeroEndpoint) {}

    function mint(address _tokenOwner, uint _newId) external payable {
        _safeMint(_tokenOwner, _newId);
    }
}
