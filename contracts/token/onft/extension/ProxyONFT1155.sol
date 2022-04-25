// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../../../lzApp/NonblockingLzApp.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "../IONFT1155.sol";

contract ProxyONFT1155 is IONFT1155, NonblockingLzApp, IERC1155Receiver {
    IERC1155 public immutable token;

    constructor(address _lzEndpoint, address _proxyToken) NonblockingLzApp(_lzEndpoint) {
        token = IERC1155(_proxyToken);
    }

    function estimateSendFee(
        uint16 _dstChainId,
        bytes calldata _toAddress,
        uint, /*_tokenId*/
        uint, /*_amount*/
        bool _useZro,
        bytes calldata _adapterParams
    ) external view virtual override returns (uint nativeFee, uint zroFee) {
        // by sending a uint array, we can decode the payload on the other side the same way regardless if its a batch
        uint[] memory tokenIds = new uint[](1);
        uint[] memory amounts = new uint[](1);
        tokenIds[0] = 0;
        amounts[0] = 0;

        bytes memory payload = abi.encode(_toAddress, tokenIds, amounts);
        return lzEndpoint.estimateFees(_dstChainId, address(this), payload, _useZro, _adapterParams);
    }

    function estimateSendBatchFee(uint16 _dstChainId, bytes calldata _toAddress, uint[] memory _tokenIds, uint[] memory _amounts, bool _useZro, bytes calldata _adapterParams) external view virtual override returns (uint nativeFee, uint zroFee) {
        bytes memory payload = abi.encode(_toAddress, _tokenIds, _amounts);
        return lzEndpoint.estimateFees(_dstChainId, address(this), payload, _useZro, _adapterParams);
    }

    function sendFrom(address _from, uint16 _dstChainId, bytes calldata _toAddress, uint _tokenId, uint _amount, address payable _refundAddress, address _zroPaymentAddress, bytes calldata _adapterParam) external payable virtual override {
        _send(_from, _dstChainId, _toAddress, _tokenId, _amount, _refundAddress, _zroPaymentAddress, _adapterParam);
    }

    function sendBatchFrom(address _from, uint16 _dstChainId, bytes calldata _toAddress, uint[] memory _tokenIds, uint[] memory _amounts, address payable _refundAddress, address _zroPaymentAddress, bytes calldata _adapterParam) external payable virtual override {
        _sendBatch(_from, _dstChainId, _toAddress, _tokenIds, _amounts, _refundAddress, _zroPaymentAddress, _adapterParam);
    }

    function send(uint16 _dstChainId, bytes calldata _toAddress, uint _tokenId, uint _amount, address payable _refundAddress, address _zroPaymentAddress, bytes calldata _adapterParam) external payable virtual override {
        _send(_msgSender(), _dstChainId, _toAddress, _tokenId, _amount, _refundAddress, _zroPaymentAddress, _adapterParam);
    }

    function sendBatch(uint16 _dstChainId, bytes calldata _toAddress, uint[] memory _tokenIds, uint[] memory _amounts, address payable _refundAddress, address _zroPaymentAddress, bytes calldata _adapterParam) external payable virtual override {
        _sendBatch(_msgSender(), _dstChainId, _toAddress, _tokenIds, _amounts, _refundAddress, _zroPaymentAddress, _adapterParam);
    }

    function _send(address _from, uint16 _dstChainId, bytes memory _toAddress, uint _tokenId, uint _amount, address payable _refundAddress, address _zroPaymentAddress, bytes calldata _adapterParam) internal virtual {
        // on the src chain we burn the tokens before sending
        _beforeSend(_from, _dstChainId, _toAddress, _tokenId, _amount);

        // by sending a uint array, we can decode the payload on the other side the same way regardless if its a batch
        uint[] memory tokenIds = new uint[](1);
        uint[] memory amounts = new uint[](1);
        tokenIds[0] = _tokenId;
        amounts[0] = _amount;

        bytes memory payload = abi.encode(_toAddress, tokenIds, amounts);
        _lzSend(_dstChainId, payload, _refundAddress, _zroPaymentAddress, _adapterParam);

        uint64 nonce = lzEndpoint.getOutboundNonce(_dstChainId, address(this));
        emit SendToChain(_from, _dstChainId, _toAddress, _tokenId, _amount, nonce);
        _afterSend(_from, _dstChainId, _toAddress, _tokenId, _amount);
    }

    function _sendBatch(address _from, uint16 _dstChainId, bytes memory _toAddress, uint[] memory _tokenIds, uint[] memory _amounts, address payable _refundAddress, address _zroPaymentAddress, bytes calldata _adapterParam) internal virtual {
        require(_tokenIds.length == _amounts.length, "ONFT1155: ids and amounts must be same length");

        // on the src chain we burn the tokens before sending
        _beforeSendBatch(_from, _dstChainId, _toAddress, _tokenIds, _amounts);

        bytes memory payload = abi.encode(_toAddress, _tokenIds, _amounts);
        _lzSend(_dstChainId, payload, _refundAddress, _zroPaymentAddress, _adapterParam);

        uint64 nonce = lzEndpoint.getOutboundNonce(_dstChainId, address(this));
        emit SendBatchToChain(_from, _dstChainId, _toAddress, _tokenIds, _amounts, nonce);
        _afterSendBatch(_from, _dstChainId, _toAddress, _tokenIds, _amounts);
    }

    function _nonblockingLzReceive(uint16 _srcChainId, bytes memory _srcAddress, uint64 _nonce, bytes memory _payload) internal virtual override {
        _beforeReceive(_srcChainId, _srcAddress, _payload);

        // decode and load the toAddress
        (bytes memory toAddress, uint[] memory tokenIds, uint[] memory amounts) = abi.decode(_payload, (bytes, uint[], uint[]));
        address localToAddress;
        assembly {
            localToAddress := mload(add(toAddress, 20))
        }
        // if the toAddress is 0x0, convert to dead address, or it will get cached
        if (localToAddress == address(0x0)) localToAddress == address(0xdEaD);

        // mint the tokens on the dst chain
        if (tokenIds.length == 1) {
            _afterReceive(_srcChainId, localToAddress, tokenIds[0], amounts[0]);
            emit ReceiveFromChain(_srcChainId, localToAddress, tokenIds[0], amounts[0], _nonce);
        } else if (tokenIds.length > 1) {
            _afterReceiveBatch(_srcChainId, localToAddress, tokenIds, amounts);
            emit ReceiveBatchFromChain(_srcChainId, localToAddress, tokenIds, amounts, _nonce);
        }
    }

    function _beforeSend(
        address _from,
        uint16, /* _dstChainId */
        bytes memory, /* _toAddress */
        uint _tokenId,
        uint _amount
    ) internal virtual {
        token.safeTransferFrom(_from, address(this), _tokenId, _amount, "0x");
    }

    function _beforeSendBatch(
        address _from,
        uint16, /* _dstChainId */
        bytes memory, /* _toAddress */
        uint[] memory _tokenIds,
        uint[] memory _amounts
    ) internal virtual {
        token.safeBatchTransferFrom(_from, address(this), _tokenIds, _amounts, "0x");
    }

    function _afterSend(
        address, /* _from */
        uint16, /* _dstChainId */
        bytes memory, /* _toAddress */
        uint, /* _tokenId */
        uint _amount
    ) internal virtual {}

    function _afterSendBatch(
        address, /* _from */
        uint16, /* _dstChainId */
        bytes memory, /* _toAddress */
        uint[] memory, /* _tokenIds */
        uint[] memory /* _amounts */
    ) internal virtual {}

    function _beforeReceive(
        uint16, /* _srcChainId */
        bytes memory, /* _srcAddress */
        bytes memory /* _payload */
    ) internal virtual {}

    function _afterReceive(
        uint16, /* _srcChainId */
        address _toAddress,
        uint _tokenId,
        uint _amount
    ) internal virtual {
        token.safeTransferFrom(address(this), _toAddress, _tokenId, _amount, "0x");
    }

    function _afterReceiveBatch(
        uint16, /* _srcChainId */
        address _toAddress,
        uint[] memory _tokenIds,
        uint[] memory _amounts
    ) internal virtual {
        token.safeBatchTransferFrom(address(this), _toAddress, _tokenIds, _amounts, "0x");
    }

    function onERC1155Received(address, address, uint, uint, bytes memory) public virtual override returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint[] calldata, uint[] calldata, bytes memory) public virtual override returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(IERC165) returns (bool) {
        return interfaceId == type(IERC1155Receiver).interfaceId;
    }
}
