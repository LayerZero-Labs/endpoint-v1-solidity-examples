// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../token/onft/extension/DistributeONFT721.sol";

contract DistributeONFT721Mock is DistributeONFT721 {
    constructor(
        address _layerZeroEndpoint,
        uint[] memory _indexArray,
        uint[] memory _valueArray
    ) DistributeONFT721("ExampleDistribute", "ONFT", 150000, _layerZeroEndpoint, _indexArray, _valueArray) {}

    function mint() public {
        require(countAllSetBits() >= 1, "DistributeONFT721: Not enough tokens to Mint");
        uint tokenId = _getNextMintTokenIdAndClearFlag();
        _safeMint(msg.sender, tokenId);
    }

    function rawOwnerOf(uint256 tokenId) public view returns (address) {
        if(_exists(tokenId)) {
            return ownerOf(tokenId);
        }
        return address(0);
    }
}