// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

import "../token/onft/ONFT721.sol";

contract ONFT721Mock is ONFT721 {
    constructor(string memory _name, string memory _symbol, uint256 _minGasToStore, address _layerZeroEndpoint) ONFT721(_name, _symbol, _minGasToStore, _layerZeroEndpoint) {}

    function mint(address _tokenOwner, uint _newId) external payable {
        _safeMint(_tokenOwner, _newId);
    }
}
