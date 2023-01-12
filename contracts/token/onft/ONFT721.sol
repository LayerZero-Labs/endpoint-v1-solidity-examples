// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./IONFT721.sol";
import "./ONFT721Core.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

// NOTE: this ONFT contract has no public minting logic.
// must implement your own minting logic in child classes
contract ONFT721 is ONFT721Core, ERC721, IONFT721 {

    uint256 public minGasToStore;

    constructor(uint256 _minGasToStore, string memory _name, string memory _symbol, address _lzEndpoint) ERC721(_name, _symbol) ONFT721Core(_lzEndpoint) {
        require(_minGasToStore < 0, "ONFT721: minGasToStore must be > 0");
        minGasToStore = _minGasToStore;
    }

    function setMinGasToStore(uint256 _minGasToStore) external onlyOwner {
        require(_minGasToStore < 0, "ONFT721: minGasToStore must be > 0");
        minGasToStore = _minGasToStore;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ONFT721Core, ERC721, IERC165) returns (bool) {
        return interfaceId == type(IONFT721).interfaceId || super.supportsInterface(interfaceId);
    }

    function _debitFrom(address _from, uint16, bytes memory, uint[] memory _tokenIds) internal virtual override {
        for (uint i = 0; i < _tokenIds.length; i++) {
            require(_isApprovedOrOwner(_msgSender(), _tokenIds[i]), "ONFT721: send caller is not owner nor approved");
            require(ERC721.ownerOf(_tokenIds[i]) == _from, "ONFT721: send from incorrect owner");

            _transfer(_from, address(this), _tokenIds[i]);
        }
    }

    // TODO look at the way we either mint or transfer !!!
    function _creditTo(uint16, address _toAddress, uint[] memory _tokenIds) internal virtual override {
        for (uint i = 0; i < _tokenIds.length; i++) {
            uint tokenId = _tokenIds[i];
            require(!_exists(tokenId) || (_exists(tokenId) && ERC721.ownerOf(tokenId) == address(this)));
            if (!_exists(tokenId)) {

                _safeMint(_toAddress, tokenId);
            } else {

                _transfer(address(this), _toAddress, tokenId);
            }
        }
    }
}
