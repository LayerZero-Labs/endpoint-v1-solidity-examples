// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "erc721a/contracts/ERC721A.sol";
import "erc721a/contracts/IERC721A.sol";
import "./interfaces/IONFT721.sol";
import "./ONFT721Core.sol";

// DISCLAIMER:
// This contract can only be deployed on one chain and must be the first minter of each token id!
// This is because ERC721A does not have the ability to mint a specific token id.
// Other chains must have ONFT721 deployed.

// NOTE: this ONFT contract has no public minting logic.
// must implement your own minting logic in child contract
contract ONFT721A is ONFT721Core, ERC721A, ERC721A__IERC721Receiver {
    constructor(
        string memory _name,
        string memory _symbol,
        uint _minGasToTransferAndStore,
        address _lzEndpoint
    ) ERC721A(_name, _symbol) ONFT721Core(_minGasToTransferAndStore, _lzEndpoint) {}

    function supportsInterface(bytes4 interfaceId) public view virtual override(ONFT721Core, ERC721A) returns (bool) {
        return interfaceId == type(IONFT721Core).interfaceId || super.supportsInterface(interfaceId);
    }

    function _debitFrom(
        address _from,
        uint16,
        bytes memory,
        uint _tokenId
    ) internal virtual override(ONFT721Core) {
        safeTransferFrom(_from, address(this), _tokenId);
    }

    function _creditTo(
        uint16,
        address _toAddress,
        uint _tokenId
    ) internal virtual override(ONFT721Core) {
        require(_exists(_tokenId) && ERC721A.ownerOf(_tokenId) == address(this));
        safeTransferFrom(address(this), _toAddress, _tokenId);
    }

    function onERC721Received(
        address,
        address,
        uint,
        bytes memory
    ) public virtual override returns (bytes4) {
        return ERC721A__IERC721Receiver.onERC721Received.selector;
    }
}
