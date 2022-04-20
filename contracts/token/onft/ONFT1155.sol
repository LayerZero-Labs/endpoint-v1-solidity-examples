// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./IONFT1155.sol";
import "../../lzApp/NonblockingLzApp.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

// NOTE: this ONFT contract has no public minting logic.
// must implement your own minting logic in child classes
contract ONFT1155 is IONFT1155, NonblockingLzApp, ERC1155 {
    string public baseTokenURI;

    constructor(string memory uri_, address _lzEndpoint) ERC1155(uri_) NonblockingLzApp(_lzEndpoint) {}

    function estimateSendFee(uint16 _dstChainId, bytes calldata /*_toAddress*/, uint /*_tokenId*/, uint /*_amount*/, bool _useZro, bytes calldata _adapterParams) public view override virtual returns (uint nativeFee, uint zroFee) {
        uint[] memory tokenIds = new uint[](1);
        uint[] memory amounts= new uint[](1);
        tokenIds[0] = 0;
        amounts[0] = 0;

        bytes memory payload = abi.encode(address(0x0), tokenIds, amounts);
        return lzEndpoint.estimateFees(_dstChainId, address(this), payload, _useZro, _adapterParams);
    }

    function estimateSendBatchFee(uint16 _dstChainId, bytes calldata /*_toAddress*/, uint[] memory _tokenIds, uint[] memory _amounts, bool _useZro, bytes calldata _adapterParams) public view override virtual returns (uint nativeFee, uint zroFee) {
        bytes memory payload = abi.encode(address(0x0), _tokenIds, _amounts);
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
        require(_msgSender() == _from || isApprovedForAll(_from, _msgSender()), "ERC1155: transfer caller is not owner nor approved");
        _beforeSend(_from, _dstChainId, _toAddress, _tokenId, _amount);

        uint[] memory tokenIds = new uint[](1);
        uint[] memory amounts= new uint[](1);
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
        require(_msgSender() == _from || isApprovedForAll(_msgSender(), _msgSender()), "ERC1155: transfer caller is not owner nor approved");
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

        // if the toAddress is 0x0, burn it or it will get cached
        if (localToAddress == address(0x0)) localToAddress == address(0xdEaD);

        if (tokenIds.length == 1) {
            _afterReceive(_srcChainId, localToAddress, tokenIds[0], amounts[0]);
            emit ReceiveFromChain(_srcChainId, localToAddress, tokenIds[0], amounts[0], _nonce);
        } else if (tokenIds.length > 1) {
            _afterReceiveBatch(_srcChainId, localToAddress, tokenIds, amounts);
            emit ReceiveBatchFromChain(_srcChainId, localToAddress, tokenIds, amounts, _nonce);
        }
    }

    function _beforeSend(address _from, uint16 /* _dstChainId */, bytes memory /* _toAddress */, uint _tokenId, uint _amount) internal virtual {
        _burn(_from, _tokenId, _amount);
    }

    function _beforeSendBatch(address _from, uint16 /* _dstChainId */, bytes memory /* _toAddress */, uint[] memory _tokenIds, uint[] memory _amounts) internal virtual {
        _burnBatch(_from, _tokenIds, _amounts);
    }

    function _afterSend(address /* _from */, uint16 /* _dstChainId */, bytes memory /* _toAddress */, uint/* _tokenId */, uint /* _amount */) internal virtual {}

    function _afterSendBatch(address /* _from */, uint16 /* _dstChainId */, bytes memory /* _toAddress */, uint[] memory /* _tokenIds */, uint[] memory /* _amounts */) internal virtual {}

    function _beforeReceive(uint16 /* _srcChainId */, bytes memory /* _srcAddress */, bytes memory /* _payload */) internal virtual {}

    function _afterReceive(uint16 /* _srcChainId */, address _toAddress, uint _tokenId, uint _amount) internal virtual {
        _mint(_toAddress, _tokenId, _amount, "0x");
    }

    function _afterReceiveBatch(uint16 /* _srcChainId */, address _toAddress, uint[] memory _tokenIds, uint[] memory _amounts) internal virtual {
        _mintBatch(_toAddress, _tokenIds, _amounts, "0x");
    }
}
