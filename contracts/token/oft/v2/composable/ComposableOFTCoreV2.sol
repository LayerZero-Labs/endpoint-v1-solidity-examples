// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../OFTCoreV2.sol";
import "../../composable/IOFTReceiver.sol";
import "../../composable/IComposableOFTCore.sol";
import "../../../../util/ExcessivelySafeCall.sol";

abstract contract ComposableOFTCoreV2 is OFTCoreV2, IComposableOFTCore {
    using ExcessivelySafeCall for address;
    using BytesLib for bytes;

    // packet type
    uint8 public constant PT_SEND_AND_CALL = 1;

    mapping(uint16 => mapping(bytes => mapping(uint64 => bytes32))) public failedOFTReceivedMessages;

    constructor(uint8 _sharedDecimals, address _lzEndpoint) OFTCoreV2(_sharedDecimals, _lzEndpoint) {}

    function supportsInterface(bytes4 interfaceId) public view virtual override(OFTCoreV2, IERC165) returns (bool) {
        return interfaceId == type(IComposableOFTCore).interfaceId || super.supportsInterface(interfaceId);
    }

    function estimateSendAndCallFee(uint16 _dstChainId, bytes calldata _toAddress, uint _amount, bytes calldata _payload, uint64 _dstGasForCall, bool _useZro, bytes calldata _adapterParams) public view virtual override returns (uint nativeFee, uint zroFee) {
        // mock the payload for sendAndCall()
        bytes memory payload = _encodeSendAndCallPayload(msg.sender, _toAddress, _ld2sd(_amount), _payload, _dstGasForCall);
        return lzEndpoint.estimateFees(_dstChainId, address(this), payload, _useZro, _adapterParams);
    }

    function sendAndCall(address _from, uint16 _dstChainId, bytes calldata _toAddress, uint _amount, bytes calldata _payload, uint64 _dstGasForCall, address payable _refundAddress, address _zroPaymentAddress, bytes calldata _adapterParams) public payable virtual override {
        _sendAndCall(_from, _dstChainId, _toAddress, _amount, _payload, _dstGasForCall, _refundAddress, _zroPaymentAddress, _adapterParams);
    }

    function retryOFTReceived(uint16 _srcChainId, bytes calldata _srcAddress, uint64 _nonce, bytes calldata _from, address _to, uint _amount, bytes calldata _payload) public virtual override {
        bytes32 msgHash = failedOFTReceivedMessages[_srcChainId][_srcAddress][_nonce];
        require(msgHash != bytes32(0), "ComposableOFTCore: no failed message to retry");

        bytes32 hash = keccak256(abi.encode(_from, _to, _amount, _payload));
        require(hash == msgHash, "ComposableOFTCore: failed message hash mismatch");

        delete failedOFTReceivedMessages[_srcChainId][_srcAddress][_nonce];
        IOFTReceiver(_to).onOFTReceived(_srcChainId, _srcAddress, _nonce, _from, _amount, _payload);
        emit RetryOFTReceivedSuccess(hash);
    }

    function _nonblockingLzReceive(uint16 _srcChainId, bytes memory _srcAddress, uint64 _nonce, bytes memory _payload) internal virtual override {
        uint8 packetType = _payload.toUint8(0);

        if (packetType == PT_SEND) {
            _sendAck(_srcChainId, _srcAddress, _nonce, _payload);
        } else if (packetType == PT_SEND_AND_CALL) {
            _sendAndCallAck(_srcChainId, _srcAddress, _nonce, _payload);
        } else {
            revert("ComposableOFTCore: unknown packet type");
        }
    }

    function _sendAndCall(address _from, uint16 _dstChainId, bytes memory _toAddress, uint _amount, bytes calldata _payload, uint64 _dstGasForCall, address payable _refundAddress, address _zroPaymentAddress, bytes memory _adapterParams) internal virtual {
        _checkAdapterParams(_dstChainId, PT_SEND_AND_CALL, _adapterParams, _dstGasForCall);

        (uint amount,) = _payOFTFee(_from, _dstChainId, _amount);

        (amount,) = _removeDust(amount);
        amount = _debitFrom(_from, _dstChainId, _toAddress, amount);

        // encode the msg.sender into the payload instead of _from
        bytes memory lzPayload = _encodeSendAndCallPayload(msg.sender, _toAddress, _ld2sd(amount), _payload, _dstGasForCall);
        _lzSend(_dstChainId, lzPayload, _refundAddress, _zroPaymentAddress, _adapterParams, msg.value);

        emit SendToChain(_dstChainId, _from, _toAddress, amount);
    }

    function _sendAndCallAck(uint16 _srcChainId, bytes memory _srcAddress, uint64 _nonce, bytes memory _payload) internal virtual {
        (bytes memory from, address to, uint64 amountSD, bytes memory payload, uint64 gasForCall) = _decodeSendAndCallPayload(_payload);

        uint amount = _sd2ld(amountSD);
        amount = _creditTo(_srcChainId, to, amount);
        emit ReceiveFromChain(_srcChainId, to, amount);

        if (!_isContract(to)) {
            emit NonContractAddress(to);
            return;
        }

        _safeCallOnOFTReceived(_srcChainId, _srcAddress, _nonce, from, to, amount, payload, gasForCall);
    }

    function _safeCallOnOFTReceived(uint16 _srcChainId, bytes memory _srcAddress, uint64 _nonce, bytes memory _from, address _to, uint _amount, bytes memory _payload, uint64 _gasForCall) internal virtual {
        (bool success, bytes memory reason) = _to.excessivelySafeCall(_gasForCall, 150, abi.encodeWithSelector(IOFTReceiver.onOFTReceived.selector, _srcChainId, _srcAddress, _nonce, _from, _amount, _payload));
        if (!success) {
            failedOFTReceivedMessages[_srcChainId][_srcAddress][_nonce] = keccak256(abi.encode(_from, _to, _amount, _payload));
            emit CallOFTReceivedFailure(_srcChainId, _srcAddress, _nonce, _from, _to, _amount, _payload, reason);
        } else {
            bytes32 hash = keccak256(abi.encode(_from, _to, _amount, _payload));
            emit CallOFTReceivedSuccess(_srcChainId, _srcAddress, _nonce, hash);
        }
    }

    function _isContract(address _account) internal view returns (bool) {
        return _account.code.length > 0;
    }

    // todo: testing
    function _encodeSendAndCallPayload(address _from, bytes memory _toAddress, uint64 _amountSD, bytes calldata _payload, uint64 _dstGasForCall) internal virtual view returns (bytes memory) {
        return abi.encodePacked(
            PT_SEND_AND_CALL,
            uint8(_toAddress.length),
            _toAddress,
            _amountSD,
            uint8(20),
            _from,
            uint8(_payload.length),
            _payload,
            _dstGasForCall
        );
    }

    function _decodeSendAndCallPayload(bytes memory _payload) internal virtual view returns (bytes memory from, address to, uint64 amountSD, bytes memory payload, uint64 dstGasForCall) {
        require(_payload.toUint8(0) == PT_SEND_AND_CALL, "ComposableOFTCore: invalid send and call payload");

        // to address
        uint8 toAddressSize = _payload.toUint8(1);
        require(toAddressSize == 20, "ComposableOFTCore: invalid to address size");
        to = _payload.toAddress(2);

        // token amount
        amountSD = _payload.toUint64(22);

        // from address
        uint8 fromAddressSize = _payload.toUint8(30);
        from = _payload.slice(31, fromAddressSize);

        // payload
        uint8 payloadSize = _payload.toUint8(31 + fromAddressSize);
        payload = _payload.slice(32 + fromAddressSize, payloadSize);

        // dst gas
        dstGasForCall = _payload.toUint64(32 + fromAddressSize + payloadSize);
    }
}
