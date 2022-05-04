// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../ONFT1155Core.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";

contract ProxyONFT1155 is ONFT1155Core, IERC1155Receiver {
    using ERC165Checker for address;

    IERC1155 public immutable token;

    constructor(address _lzEndpoint, address _proxyToken) ONFT1155Core(_lzEndpoint) {
        require(_proxyToken.supportsInterface(type(IERC1155).interfaceId), "ProxyONFT1155: invalid ERC1155 token");
        token = IERC1155(_proxyToken);
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ONFT1155Core, IERC165) returns (bool) {
        return interfaceId == type(IERC1155Receiver).interfaceId || super.supportsInterface(interfaceId);
    }

    function _debitFrom(address _from, uint16, bytes memory, uint[] memory _tokenIds, uint[] memory _amounts) internal virtual override {
        require(_from == _msgSender(), "ProxyONFT1155: owner is not send caller");
        token.safeBatchTransferFrom(_from, address(this), _tokenIds, _amounts, "");
    }

    function _creditTo(uint16, address _toAddress, uint[] memory _tokenIds, uint[] memory _amounts) internal virtual override {
        token.safeBatchTransferFrom(address(this), _toAddress, _tokenIds, _amounts, "");
    }

    function onERC1155Received(address _operator, address, uint, uint, bytes memory) public virtual override returns (bytes4) {
        // only allow `this` to tranfser token from others
        if (_operator != address(this)) return bytes4(0);
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address _operator, address, uint[] memory, uint[] memory, bytes memory) public virtual override returns (bytes4) {
        // only allow `this` to tranfser token from others
        if (_operator != address(this)) return bytes4(0);
        return this.onERC1155BatchReceived.selector;
    }
}
