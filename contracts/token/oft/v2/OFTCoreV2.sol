// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../../../lzApp/NonblockingLzApp.sol";
import "../IOFTCore.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";

abstract contract OFTCoreV2 is NonblockingLzApp, ERC165, IOFTCore {
    using BytesLib for bytes;

    uint8 public constant SHARE_DECIMALS = 6;
    uint public constant NO_EXTRA_GAS = 0;

    // packet type
    uint8 public constant PT_SEND = 0;

    bool public useCustomAdapterParams;
    bool public isBaseOFT;
    uint64 public outboundAmountSD; // total outbound amount in share decimals, that is sent to other chains and should not exceed max of uint64

    constructor(bool _base, address _lzEndpoint) NonblockingLzApp(_lzEndpoint) {
        isBaseOFT = _base;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IERC165) returns (bool) {
        return interfaceId == type(IOFTCore).interfaceId || super.supportsInterface(interfaceId);
    }

    function estimateSendFee(uint16 _dstChainId, bytes calldata _toAddress, uint _amount, bool _useZro, bytes calldata _adapterParams) public view virtual override returns (uint nativeFee, uint zroFee) {
        // mock the payload for sendFrom()
        bytes memory payload = abi.encode(PT_SEND, abi.encodePacked(msg.sender), _toAddress, _amount);
        return lzEndpoint.estimateFees(_dstChainId, address(this), payload, _useZro, _adapterParams);
    }

    function sendFrom(address _from, uint16 _dstChainId, bytes calldata _toAddress, uint _amount, address payable _refundAddress, address _zroPaymentAddress, bytes calldata _adapterParams) public payable virtual override {
        _send(_from, _dstChainId, _toAddress, _amount, _refundAddress, _zroPaymentAddress, _adapterParams);
    }

    function setUseCustomAdapterParams(bool _useCustomAdapterParams) public virtual onlyOwner {
        useCustomAdapterParams = _useCustomAdapterParams;
        emit SetUseCustomAdapterParams(_useCustomAdapterParams);
    }

    function _nonblockingLzReceive(uint16 _srcChainId, bytes memory _srcAddress, uint64 _nonce, bytes memory _payload) internal virtual override {
        uint8 packetType = _payload.toUint8(0);

        if (packetType == PT_SEND) {
            _sendAck(_srcChainId, _srcAddress, _nonce, _payload);
        } else {
            revert("OFTCore: unknown packet type");
        }
    }

    function _send(address _from, uint16 _dstChainId, bytes memory _toAddress, uint _amount, address payable _refundAddress, address _zroPaymentAddress, bytes memory _adapterParams) internal virtual {
        _checkAdapterParams(_dstChainId, PT_SEND, _adapterParams, NO_EXTRA_GAS);

        uint amount = _debitFrom(_from, _dstChainId, _toAddress, _amount);

        uint64 amountSD = _LD2SD(amount);
        if (isBaseOFT) {
            require(type(uint32).max - outboundAmountSD >= amountSD, "OFTCore: outboundAmountSD overflow");
            outboundAmountSD += amountSD;
        }

        bytes memory lzPayload = abi.encode(PT_SEND, abi.encodePacked(_from), _toAddress, amountSD);
        _lzSend(_dstChainId, lzPayload, _refundAddress, _zroPaymentAddress, _adapterParams, msg.value);

        emit SendToChain(_dstChainId, _from, _toAddress, amount);
    }

    function _sendAck(uint16 _srcChainId, bytes memory, uint64, bytes memory _payload) internal virtual {
        (bytes memory from, address to, uint64 amountSD) = _decodeSendPayload(_payload);

        if (isBaseOFT) {
            outboundAmountSD -= amountSD;
        }
        uint amount = _SD2LD(amountSD);

        _creditTo(_srcChainId, to, amount);
        emit ReceiveFromChain(_srcChainId, from, to, amount);
    }

    function _checkAdapterParams(uint16 _dstChainId, uint16 _pkType, bytes memory _adapterParams, uint _extraGas) internal virtual {
        if (useCustomAdapterParams) {
            _checkGasLimit(_dstChainId, _pkType, _adapterParams, _extraGas);
        } else {
            require(_adapterParams.length == 0, "OFTCore: _adapterParams must be empty.");
        }
    }

    function _LD2SD(uint _amount) internal virtual view returns (uint64) {
        uint8 decimals = _decimals();
        uint amountSD = decimals > SHARE_DECIMALS ? _amount / (10 ** (decimals - SHARE_DECIMALS)) : _amount;
        require(amountSD <= type(uint64).max, "OFTCore: amountSD overflow");
        return uint64(amountSD);
    }

    function _SD2LD(uint64 _amountSD) internal virtual view returns (uint) {
        uint8 decimals = _decimals();
        uint amount = decimals > SHARE_DECIMALS ? _amountSD * (10 ** (decimals - SHARE_DECIMALS)) : _amountSD;
        return amount;
    }

    function _removeDust(uint _amount) internal virtual view returns (uint) {
        return _SD2LD(_LD2SD(_amount));
    }

    function _encodeSendPayload(address _from, bytes memory _toAddress, uint64 _amountSD) internal virtual view returns (bytes memory) {
        return abi.encodePacked(
            PT_SEND,
            uint8(20),
            _from,
            uint8(_toAddress.length),
            _toAddress,
            _amountSD
        );
    }

    function _decodeSendPayload(bytes memory _payload) internal virtual view returns (bytes memory fromAddress, address to, uint64 amountSD) {
        uint8 pkType = _payload.toUint8(0);
        uint8 fromAddressSize = _payload.toUint8(1);
        uint8 toAddressSize = _payload.toUint8(2 + fromAddressSize);
        require(
            pkType == PT_SEND && toAddressSize == 20 && _payload.length == 31 + fromAddressSize,
            "OFTCore: invalid send payload"
        );
        fromAddress = _payload.slice(2, fromAddressSize);
        to = _payload.toAddress(3 + fromAddressSize);
        amountSD = _payload.toUint64(23 + fromAddressSize);
    }

    function _debitFrom(address _from, uint16 _dstChainId, bytes memory _toAddress, uint _amount) internal virtual returns (uint);

    function _creditTo(uint16 _srcChainId, address _toAddress, uint _amount) internal virtual;

    function _decimals() internal virtual view returns (uint8);
}
