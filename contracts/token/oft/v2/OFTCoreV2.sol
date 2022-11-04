// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../../../lzApp/NonblockingLzApp.sol";
import "./IOFTCoreV2.sol";
import "./OFTFee.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";

abstract contract OFTCoreV2 is NonblockingLzApp, OFTFee, ERC165, IOFTCoreV2 {
    using BytesLib for bytes;

    uint public constant NO_EXTRA_GAS = 0;

    // packet type
    uint8 public constant PT_SEND = 0;

    bool public useCustomAdapterParams;

    uint8 public immutable sharedDecimals;

    // _sharedDecimals should be the minimum decimals on all chains
    constructor(uint8 _sharedDecimals, address _lzEndpoint) NonblockingLzApp(_lzEndpoint) {
        sharedDecimals = _sharedDecimals;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IERC165) returns (bool) {
        return interfaceId == type(IOFTCoreV2).interfaceId || super.supportsInterface(interfaceId);
    }

    function estimateSendFee(uint16 _dstChainId, bytes calldata _toAddress, uint _amount, bool _useZro, bytes calldata _adapterParams) public view virtual override returns (uint nativeFee, uint zroFee) {
        // mock the payload for sendFrom()
        bytes memory payload = _encodeSendPayload(_toAddress, _ld2sd(_amount));
        return lzEndpoint.estimateFees(_dstChainId, address(this), payload, _useZro, _adapterParams);
    }

    function sendFrom(address _from, uint16 _dstChainId, bytes calldata _toAddress, uint _amount, uint _minAmount, LzCallParams calldata _callParams, bytes calldata _adapterParams) public payable virtual override {
        _send(_from, _dstChainId, _toAddress, _amount, _minAmount, _callParams, _adapterParams);
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

    function _send(address _from, uint16 _dstChainId, bytes memory _toAddress, uint _amount, uint _minAmount, LzCallParams calldata _callParams, bytes memory _adapterParams) internal virtual {
        _checkAdapterParams(_dstChainId, PT_SEND, _adapterParams, NO_EXTRA_GAS);

        (uint amount,) = _payOFTFee(_from, _dstChainId, _amount);

        (amount,) = _removeDust(amount);
        amount = _debitFrom(_from, _dstChainId, _toAddress, amount);
        require(amount >= _minAmount, "OFTCore: amount < minAmount");

        bytes memory lzPayload = _encodeSendPayload(_toAddress, _ld2sd(amount));
        _lzSend(_dstChainId, lzPayload, _callParams.refundAddress, _callParams.zroPaymentAddress, _adapterParams, msg.value);

        emit SendToChain(_dstChainId, _from, _toAddress, amount);
    }

    function _sendAck(uint16 _srcChainId, bytes memory, uint64, bytes memory _payload) internal virtual {
        (address to, uint64 amountSD) = _decodeSendPayload(_payload);
        uint amount = _sd2ld(amountSD);
        amount = _creditTo(_srcChainId, to, amount);
        emit ReceiveFromChain(_srcChainId, to, amount);
    }

    function _checkAdapterParams(uint16 _dstChainId, uint16 _pkType, bytes memory _adapterParams, uint _extraGas) internal virtual {
        if (useCustomAdapterParams) {
            _checkGasLimit(_dstChainId, _pkType, _adapterParams, _extraGas);
        } else {
            require(_adapterParams.length == 0, "OFTCore: _adapterParams must be empty.");
        }
    }

    function _ld2sd(uint _amount) internal virtual view returns (uint64) {
        uint amountSD = _amount / _ld2sdRate();
        require(amountSD <= type(uint64).max, "OFTCore: amountSD overflow");
        return uint64(amountSD);
    }

    function _sd2ld(uint64 _amountSD) internal virtual view returns (uint) {
        return _amountSD * _ld2sdRate();
    }

    function _removeDust(uint _amount) internal virtual view returns (uint amountAfter, uint dust) {
        dust = _amount % _ld2sdRate();
        amountAfter = _amount - dust;
    }

    function _encodeSendPayload(bytes memory _toAddress, uint64 _amountSD) internal virtual view returns (bytes memory) {
        return abi.encodePacked(PT_SEND, uint8(_toAddress.length), _toAddress, _amountSD);
    }

    function _decodeSendPayload(bytes memory _payload) internal virtual view returns (address to, uint64 amountSD) {
        require(_payload.toUint8(0) == PT_SEND && _payload.length == 30, "OFTCore: invalid send payload");

        uint8 toAddressSize = _payload.toUint8(1);
        require(toAddressSize == 20, "OFTCore: invalid to address size");

        to = _payload.toAddress(2);
        amountSD = _payload.toUint64(22);
    }

    function _debitFrom(address _from, uint16 _dstChainId, bytes memory _toAddress, uint _amount) internal virtual returns (uint);

    function _creditTo(uint16 _srcChainId, address _toAddress, uint _amount) internal virtual returns (uint);

    function _ld2sdRate() internal view virtual returns (uint);
}
