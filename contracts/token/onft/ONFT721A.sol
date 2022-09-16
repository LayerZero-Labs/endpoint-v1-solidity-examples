// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "./IONFT721A.sol";
import "./ONFT721ACore.sol";
import "erc721a/contracts/ERC721A.sol";

// NOTE: this ONFT contract has no public minting logic.
// must implement your own minting logic in child classes
contract ONFT721A is ONFT721ACore, ERC721A, IONFT721A, ERC721A__IERC721Receiver {

    constructor(string memory _name, string memory _symbol, address _lzEndpoint) ERC721A(_name, _symbol) ONFT721ACore(_lzEndpoint) {}

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721A, IERC721A) returns (bool) {
        return interfaceId == type(IONFT721A).interfaceId || super.supportsInterface(interfaceId);
    }

    function _debitFrom(address _from, uint16, bytes memory, uint _tokenId) internal virtual override {
        safeTransferFrom(_from, address(this), _tokenId);
    }

    function _creditTo(uint16, address _toAddress, uint _tokenId) internal virtual override {
        require(!_exists(_tokenId) || (_exists(_tokenId) && ERC721A.ownerOf(_tokenId) == address(this)));

        if (!_exists(_tokenId)) {
            _safeMint(_toAddress, _tokenId);
        } else {
            safeTransferFrom(address(this), _toAddress, _tokenId);
        }
    }

    function onERC721Received(address, address, uint, bytes memory) public virtual override returns (bytes4) {
        return ERC721A__IERC721Receiver.onERC721Received.selector;
    }
}
