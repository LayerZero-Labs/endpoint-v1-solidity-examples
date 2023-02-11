// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../token/onft/extension/UniversalONFT721.sol";

/**
 * @dev ERC-2309: ERC-721 Consecutive Transfer Extension.
 *
 * _Available since v4.8._
 */
interface IERC2309 {
    /**
     * @dev Emitted when the tokens from `fromTokenId` to `toTokenId` are transferred from `fromAddress` to `toAddress`.
     */
    event ConsecutiveTransfer(
        uint256 indexed fromTokenId,
        uint256 toTokenId,
        address indexed fromAddress,
        address indexed toAddress
    );
}

contract ExampleTiny2309 is UniversalONFT721,IERC2309{

    string public baseURI = "ipfs://QmZPSjZKMjDUcqGuy6xS2EDQsJVFLyGHj3LUM2DkmCEfHo/";

    constructor(uint256 _minGasToStore, address _layerZeroEndpoint, uint _startMintId, uint _endMintId) UniversalONFT721("tiny2309002", "t2309002",_minGasToStore, _layerZeroEndpoint, _startMintId, _endMintId) {
        nextMintId = _startMintId;
        maxMintId = _endMintId;

        uint256 _batchSize = maxMintId - nextMintId +1;
        super._beforeTokenTransfer(address(0),owner(),0, _batchSize);
    
        uint256 last = maxMintId ;
        uint256 first = nextMintId;
        while (first < last + 1) {
                emit ConsecutiveTransfer(
                    first,
                    first + 1,
                    address(0),
                    owner()
                );
                first = first + 1;
        }
    }
  
    function _ownerOf(uint256 tokenId) internal view virtual override returns(address){
        address _owner = super._ownerOf(tokenId);
        if (_owner == address(0) && ((nextMintId <= tokenId)&&(tokenId <= maxMintId)) ) {
            return owner();
        }
        return _owner;
    }
   
    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }

}