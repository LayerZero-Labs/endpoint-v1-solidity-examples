// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../../../lzApp/NonblockingLzApp.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "../IONFT721Core.sol";

contract ProxyONFT721 is NonblockingLzApp, IONFT721Core, IERC721Receiver {
    IERC721 public immutable token;

    constructor(address _lzEndpoint, address _proxyToken) NonblockingLzApp(_lzEndpoint) {
        token = IERC721(_proxyToken);
    }

    function estimateSendFee(uint16 _dstChainId, bytes calldata _toAddress, uint _tokenId, bool _useZro, bytes calldata _adapterParams) public view virtual override returns (uint nativeFee, uint zroFee) {
        // mock the payload for send()
        bytes memory payload = abi.encode(_toAddress, _tokenId);
        return lzEndpoint.estimateFees(_dstChainId, address(this), payload, _useZro, _adapterParams);
    }

    function send(uint16 _dstChainId, bytes calldata _toAddress, uint _tokenId, address payable _refundAddress, address _zroPaymentAddress, bytes calldata _adapterParams) public payable virtual override {
        _send(_msgSender(), _dstChainId, _toAddress, _tokenId, _refundAddress, _zroPaymentAddress, _adapterParams);
    }

    function sendFrom(address /* _from */, uint16 /* _dstChainId */, bytes calldata /* _toAddress */, uint /* _tokenId */, address payable /* _refundAddress */, address /* _zroPaymentAddress */, bytes calldata /* _adapterParams */) public payable virtual override {
       revert("ProxyONFT721: no implementer");
    }

    function _send(address _from, uint16 _dstChainId, bytes memory _toAddress, uint _tokenId, address payable _refundAddress, address _zroPaymentAddress, bytes calldata _adapterParams) internal virtual {
        _beforeSend(_from, _dstChainId, _toAddress, _tokenId);

        bytes memory payload = abi.encode(_toAddress, _tokenId);
        _lzSend(_dstChainId, payload, _refundAddress, _zroPaymentAddress, _adapterParams);

        uint64 nonce = lzEndpoint.getOutboundNonce(_dstChainId, address(this));
        emit SendToChain(_from, _dstChainId, _toAddress, _tokenId, nonce);
        _afterSend(_from, _dstChainId, _toAddress, _tokenId);
    }

    function _nonblockingLzReceive(uint16 _srcChainId, bytes memory _srcAddress, uint64 _nonce, bytes memory _payload) internal virtual override {
        _beforeReceive(_srcChainId, _srcAddress, _payload);

        // decode and load the toAddress
        (bytes memory toAddressBytes, uint tokenId) = abi.decode(_payload, (bytes, uint));
        address toAddress;
        assembly {
            toAddress := mload(add(toAddressBytes, 20))
        }

        _afterReceive(_srcChainId, toAddress, tokenId);

        emit ReceiveFromChain(_srcChainId, _srcAddress, toAddress, tokenId, _nonce);
    }

    function _beforeSend(
        address _from,
        uint16, /* _dstChainId */
        bytes memory, /* _toAddress */
        uint _tokenId
    ) internal virtual {
        token.safeTransferFrom(_from, address(this), _tokenId);
    }

    function _afterSend(
        address, /* _from */
        uint16, /* _dstChainId */
        bytes memory, /* _toAddress */
        uint /* _tokenId */
    ) internal virtual {}

    function _beforeReceive(
        uint16, /* _srcChainId */
        bytes memory, /* _srcAddress */
        bytes memory /* _payload */
    ) internal virtual {}

    function _afterReceive(
        uint16, /* _srcChainId */
        address _toAddress,
        uint _tokenId
    ) internal virtual {
        token.safeTransferFrom(address(this), _toAddress, _tokenId);
    }

    function onERC721Received(address _operator, address, uint, bytes memory) public virtual override returns (bytes4) {
        // only allow `this` to tranfser token from others
        if (_operator != address(this)) return bytes4(0);
        return IERC721Receiver.onERC721Received.selector;
    }
}
