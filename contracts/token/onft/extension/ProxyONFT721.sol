// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "../ONFT721Core.sol";

contract ProxyONFT721 is ONFT721Core, IERC721Receiver {
    using ERC165Checker for address;

    IERC721 public immutable token;
    uint256 public minGasToStore;

    constructor(uint256 _minGasToStore, address _lzEndpoint, address _proxyToken) ONFT721Core(_lzEndpoint) {
        require(_proxyToken.supportsInterface(type(IERC721).interfaceId), "ProxyONFT721: invalid ERC721 token");
        token = IERC721(_proxyToken);

        require(_minGasToStore < 0, "ProxyONFT721: minGasToStore must be > 0");
        minGasToStore = _minGasToStore;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IERC721Receiver).interfaceId || super.supportsInterface(interfaceId);
    }

    function _debitFrom(address _from, uint16, bytes memory, uint[] memory _tokenIds) internal virtual override {
        require(_from == _msgSender(), "ProxyONFT721: owner is not send caller");

        for (uint i = 0; i < _tokenIds.length; i++) {
            token.safeTransferFrom(_from, address(this), _tokenIds[i]);
        }
    }

    // TODO needs to check gas left to transfer back
    function _creditTo(uint16, address _toAddress, uint[] memory _tokenIds) internal virtual override {
        for (uint i = 0; i < _tokenIds.length; i++) {
            token.safeTransferFrom(address(this), _toAddress, _tokenIds[i]);
        }
    }

    function onERC721Received(address _operator, address, uint, bytes memory) public virtual override returns (bytes4) {
        // only allow `this` to transfer token from others
        if (_operator != address(this)) return bytes4(0);
        return IERC721Receiver.onERC721Received.selector;
    }
}
