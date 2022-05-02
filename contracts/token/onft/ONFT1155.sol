// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./IONFT1155.sol";
import "../../lzApp/NonblockingLzApp.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

// NOTE: this ONFT contract has no public minting logic.
// must implement your own minting logic in child classes
contract ONFT1155 is IONFT1155, NonblockingLzApp, ERC1155 {

    constructor(string memory _uri, address _lzEndpoint) ERC1155(_uri) NonblockingLzApp(_lzEndpoint) {}

    function estimateSendFee(
        uint16 _dstChainId,
        bytes calldata _toAddress,
        uint _tokenId, 
        uint _amount, 
        bool _useZro,
        bytes calldata _adapterParams
    ) public view virtual override returns (uint nativeFee, uint zroFee) {
        return estimateSendBatchFee(_dstChainId, _toAddress, _toSingletonArray(_tokenId), _toSingletonArray(_amount), _useZro, _adapterParams);
    }

    function estimateSendBatchFee(
        uint16 _dstChainId,
        bytes calldata _toAddress,
        uint[] memory _tokenIds,
        uint[] memory _amounts,
        bool _useZro,
        bytes calldata _adapterParams
    ) public view virtual override returns (uint nativeFee, uint zroFee) {
        bytes memory payload = abi.encode(_toAddress, _tokenIds, _amounts);
        return lzEndpoint.estimateFees(_dstChainId, address(this), payload, _useZro, _adapterParams);
    }

    function sendFrom(address _from, uint16 _dstChainId, bytes calldata _toAddress, uint _tokenId, uint _amount, address payable _refundAddress, address _zroPaymentAddress, bytes calldata _adapterParams) public payable virtual override {
        _sendBatch(_from, _dstChainId, _toAddress, _toSingletonArray(_tokenId), _toSingletonArray(_amount), _refundAddress, _zroPaymentAddress, _adapterParams);
    }

    function sendBatchFrom(address _from, uint16 _dstChainId, bytes calldata _toAddress, uint[] memory _tokenIds, uint[] memory _amounts, address payable _refundAddress, address _zroPaymentAddress, bytes calldata _adapterParams) public payable virtual override {
        _sendBatch(_from, _dstChainId, _toAddress, _tokenIds, _amounts, _refundAddress, _zroPaymentAddress, _adapterParams);
    }

    function send(uint16 _dstChainId, bytes calldata _toAddress, uint _tokenId, uint _amount, address payable _refundAddress, address _zroPaymentAddress, bytes calldata _adapterParams) public payable virtual override {
        _sendBatch(_msgSender(), _dstChainId, _toAddress, _toSingletonArray(_tokenId), _toSingletonArray(_amount), _refundAddress, _zroPaymentAddress, _adapterParams);
    }

    function sendBatch(uint16 _dstChainId, bytes calldata _toAddress, uint[] memory _tokenIds, uint[] memory _amounts, address payable _refundAddress, address _zroPaymentAddress, bytes calldata _adapterParams) public payable virtual override {
        _sendBatch(_msgSender(), _dstChainId, _toAddress, _tokenIds, _amounts, _refundAddress, _zroPaymentAddress, _adapterParams);
    }

    function _sendBatch(address _from, uint16 _dstChainId, bytes memory _toAddress, uint[] memory _tokenIds, uint[] memory _amounts, address payable _refundAddress, address _zroPaymentAddress, bytes calldata _adapterParams) internal virtual {
        require(_msgSender() == _from || isApprovedForAll(_from, _msgSender()), "ONFT1155: transfer caller is not owner nor approved");

        // on the src chain we burn the tokens before sending
        _debitFrom(_from, _dstChainId, _toAddress, _tokenIds, _amounts);

        bytes memory payload = abi.encode(_toAddress, _tokenIds, _amounts);
        _lzSend(_dstChainId, payload, _refundAddress, _zroPaymentAddress, _adapterParams);

        uint64 nonce = lzEndpoint.getOutboundNonce(_dstChainId, address(this));
        if (_tokenIds.length == 1) {
            emit SendToChain(_from, _dstChainId, _toAddress, _tokenIds[0], _amounts[0], nonce);
        } else {
            emit SendBatchToChain(_from, _dstChainId, _toAddress, _tokenIds, _amounts, nonce);
        }
    }

    function _nonblockingLzReceive(uint16 _srcChainId, bytes memory _srcAddress, uint64 _nonce, bytes memory _payload) internal virtual override {
        // decode and load the toAddress
        (bytes memory toAddress, uint[] memory tokenIds, uint[] memory amounts) = abi.decode(_payload, (bytes, uint[], uint[]));
        address localToAddress;
        assembly {
            localToAddress := mload(add(toAddress, 20))
        }

        // mint the tokens on the dst chain
        _creditTo(_srcChainId, localToAddress, tokenIds, amounts);

        if (tokenIds.length == 1) {
            emit ReceiveFromChain(_srcChainId, _srcAddress, localToAddress, tokenIds[0], amounts[0], _nonce);
        } else if (tokenIds.length > 1) {
            emit ReceiveBatchFromChain(_srcChainId, _srcAddress, localToAddress, tokenIds, amounts, _nonce);
        }
    }

    function _debitFrom(
        address _from,
        uint16, /* _dstChainId */
        bytes memory, /* _toAddress */
        uint[] memory _tokenIds,
        uint[] memory _amounts
    ) internal virtual {
        _burnBatch(_from, _tokenIds, _amounts);
    }

    function _creditTo(
        uint16, /* _srcChainId */
        address _toAddress,
        uint[] memory _tokenIds,
        uint[] memory _amounts
    ) internal virtual {
        _mintBatch(_toAddress, _tokenIds, _amounts, "0x");
    }

    function _toSingletonArray(uint256 element) private pure returns (uint256[] memory) {
        uint256[] memory array = new uint256[](1);
        array[0] = element;
        return array;
    }
}
