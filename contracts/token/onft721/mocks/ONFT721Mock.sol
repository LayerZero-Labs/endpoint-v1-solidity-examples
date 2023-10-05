// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

import "../ONFT721.sol";

contract ONFT721Mock is ONFT721 {
    constructor(
        string memory _name,
        string memory _symbol,
        uint _minGasToStore,
        address _layerZeroEndpoint
    ) ONFT721(_name, _symbol, _minGasToStore, _layerZeroEndpoint) {}

    function mint(address _tokenOwner, uint _newId) external payable {
        _safeMint(_tokenOwner, _newId);
    }

    function rawOwnerOf(uint tokenId) public view returns (address) {
        if (_exists(tokenId)) {
            return ownerOf(tokenId);
        }
        return address(0);
    }
}
