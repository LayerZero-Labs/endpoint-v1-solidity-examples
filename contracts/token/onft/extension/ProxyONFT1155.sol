// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../ONFT1155Core.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

contract ProxyONFT1155 is ONFT1155Core, IERC1155Receiver {
    IERC1155 public immutable token;

    constructor(address _lzEndpoint, address _proxyToken) ONFT1155Core(_lzEndpoint) {
        token = IERC1155(_proxyToken);
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ONFT1155Core, IERC165) returns (bool) {
        return interfaceId == type(IERC1155Receiver).interfaceId || super.supportsInterface(interfaceId);
    }

    function sendFrom(address, uint16, bytes calldata, uint, uint, address payable, address, bytes calldata) public payable virtual override {
        revert("ProxyONFT1155: no implementer");
    }

    function sendBatchFrom(address, uint16, bytes calldata, uint[] memory, uint[] memory, address payable, address, bytes calldata) public payable virtual override {
        revert("ProxyONFT1155: no implementer");
    }

    function _debitFrom(address _from, uint16, bytes memory, uint[] memory _tokenIds, uint[] memory _amounts) internal virtual override {
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

    function onERC1155BatchReceived(address _operator, address, uint[] calldata, uint[] calldata, bytes memory) public virtual override returns (bytes4) {
        // only allow `this` to tranfser token from others
        if (_operator != address(this)) return bytes4(0);
        return this.onERC1155BatchReceived.selector;
    }
}
