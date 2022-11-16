// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../OFTCore.sol";
import "./IOFTReceiver.sol";
import "./IComposableOFTCore.sol";
import "../../../util/ExcessivelySafeCall.sol";

abstract contract ComposableOFTCore is OFTCore, IComposableOFTCore {
    using ExcessivelySafeCall for address;
    using BytesLib for bytes;

    // packet type
    uint16 public constant PT_SEND_AND_CALL = 1;

    mapping(uint16 => mapping(bytes => mapping(uint64 => bytes32))) public failedOFTReceivedMessages;

    constructor(address _lzEndpoint) OFTCore(_lzEndpoint) {}

    function supportsInterface(bytes4 interfaceId) public view virtual override(OFTCore, IERC165) returns (bool) {
        return interfaceId == type(IComposableOFTCore).interfaceId || super.supportsInterface(interfaceId);
    }

    function estimateSendAndCallFee(uint16 _dstChainId, bytes calldata _toAddress, uint _amount, bytes calldata _payload, uint64 _dstGasForCall, bool _useZro, bytes calldata _adapterParams) public view virtual override returns (uint nativeFee, uint zroFee) {
        // mock the payload for sendAndCall()
        bytes memory payload = abi.encode(PT_SEND_AND_CALL, abi.encodePacked(msg.sender), _toAddress, _amount, _payload, _dstGasForCall);
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
        uint16 packetType;
        assembly {
            packetType := mload(add(_payload, 32))
        }

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

        uint amount = _debitFrom(_from, _dstChainId, _toAddress, _amount);

        bytes memory lzPayload = abi.encode(PT_SEND_AND_CALL, abi.encodePacked(msg.sender), _toAddress, amount, _payload, _dstGasForCall);
        _lzSend(_dstChainId, lzPayload, _refundAddress, _zroPaymentAddress, _adapterParams, msg.value);

        emit SendToChain(_dstChainId, _from, _toAddress, amount);
    }

    function _sendAndCallAck(uint16 _srcChainId, bytes memory _srcAddress, uint64 _nonce, bytes memory _payload) internal virtual {
        (, bytes memory from, bytes memory toAddress, uint amount, bytes memory payload, uint64 gasForCall) = abi.decode(_payload, (uint16, bytes, bytes, uint, bytes, uint64));

        address to = toAddress.toAddress(0);

        amount = _creditTo(_srcChainId, to, amount);
        emit ReceiveFromChain(_srcChainId, to, amount);

        if (!_isContract(to)) {
            emit NonContractAddress(to);
            return;
        }

        _safeCallOnOFTReceived(_srcChainId, _srcAddress, _nonce, from, to, amount, payload, gasForCall);
    }

    function _safeCallOnOFTReceived(uint16 _srcChainId, bytes memory _srcAddress, uint64 _nonce, bytes memory _from, address _to, uint _amount, bytes memory _payload, uint _gasForCall) internal virtual {
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
}
