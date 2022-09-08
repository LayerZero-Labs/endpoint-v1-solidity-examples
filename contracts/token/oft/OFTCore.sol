// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../../lzApp/NonblockingLzApp.sol";
import "./IOFTCore.sol";
import "./IOFTReceiver.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "../../util/ExcessivelySafeCall.sol";

abstract contract OFTCore is NonblockingLzApp, ERC165, IOFTCore {
    using ExcessivelySafeCall for address;
    using BytesLib for bytes;

    uint public constant NO_EXTRA_GAS = 0;

    // packet type
    uint16 public constant PT_SEND = 0;
    uint16 public constant PT_SEND_AND_CALL = 0;

    mapping(uint16 => mapping(bytes => mapping(uint64 => bytes32))) public failedOFTReceivedMessages;
    bool public useCustomAdapterParams;

    constructor(address _lzEndpoint) NonblockingLzApp(_lzEndpoint) {}

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IERC165) returns (bool) {
        return interfaceId == type(IOFTCore).interfaceId || super.supportsInterface(interfaceId);
    }

    function estimateSendFee(uint16 _dstChainId, bytes memory _toAddress, uint _amount, bool _useZro, bytes memory _adapterParams) public view virtual override returns (uint nativeFee, uint zroFee) {
        // mock the payload for send()
        bytes memory payload = abi.encode(_toAddress, _amount);
        return lzEndpoint.estimateFees(_dstChainId, address(this), payload, _useZro, _adapterParams);
    }

    function sendFrom(address _from, uint16 _dstChainId, bytes memory _toAddress, uint _amount, address payable _refundAddress, address _zroPaymentAddress, bytes memory _adapterParams) public payable virtual override {
        _send(_from, _dstChainId, _toAddress, _amount, _refundAddress, _zroPaymentAddress, _adapterParams);
    }

    function sendAndCall(address _from, uint16 _dstChainId, bytes calldata _toAddress, uint _amount, bytes calldata _payload, uint _dstGasForCall, address payable _refundAddress, address _zroPaymentAddress, bytes calldata _adapterParams) external payable override {
        _sendAndCall(_from, _dstChainId, _toAddress, _amount, _payload, _dstGasForCall, _refundAddress, _zroPaymentAddress, _adapterParams);
    }

    function retryOFTReceived(uint16 _srcChainId, bytes calldata _srcAddress, uint64 _nonce, bytes calldata _from, address _to, uint _amount, bytes calldata _payload) public virtual override {
        bytes32 msgHash = failedOFTReceivedMessages[_srcChainId][_srcAddress][_nonce];
        require(msgHash != bytes32(0), "OFTCore: no failed message to retry");

        bytes32 hash = keccak256(abi.encode(_from, _to, _amount, _payload));
        require(hash == msgHash, "OFTCore: failed message hash mismatch");

        delete failedOFTReceivedMessages[_srcChainId][_srcAddress][_nonce];
        IOFTReceiver(_to).onOFTReceived(_srcChainId, _srcAddress, _nonce, _from, _amount, _payload);
        emit RetryOFTReceivedSuccess(hash);
    }

    function setUseCustomAdapterParams(bool _useCustomAdapterParams) public virtual onlyOwner {
        useCustomAdapterParams = _useCustomAdapterParams;
        emit SetUseCustomAdapterParams(_useCustomAdapterParams);
    }

    function _nonblockingLzReceive(uint16 _srcChainId, bytes calldata _srcAddress, uint64 _nonce, bytes memory _payload) internal virtual override {
        uint16 packetType;
        assembly {
            packetType := mload(add(_payload, 32))
        }

        if (packetType == PT_SEND) {
            _sendAck(_srcChainId, _srcAddress, _nonce, _payload);
        } else if (packetType == PT_SEND_AND_CALL) {
            _sendAndCallAck(_srcChainId, _srcAddress, _nonce, _payload);
        } else {
            revert("OFTCore: unknown packet type");
        }
    }

    function _send(address _from, uint16 _dstChainId, bytes memory _toAddress, uint _amount, address payable _refundAddress, address _zroPaymentAddress, bytes memory _adapterParams) internal virtual {
        _checkAdapterParams(_dstChainId, PT_SEND, _adapterParams, NO_EXTRA_GAS);

        _debitFrom(_from, _dstChainId, _toAddress, _amount);

        bytes memory lzPayload = abi.encode(PT_SEND, abi.encodePacked(_from), _toAddress, _amount);
        _lzSend(_dstChainId, lzPayload, _refundAddress, _zroPaymentAddress, _adapterParams, msg.value);

        emit SendToChain(_dstChainId, _from, _toAddress, _amount);
    }

    function _sendAck(uint16 _srcChainId, bytes memory, uint64, bytes memory _payload) internal virtual {
        (, bytes memory from, bytes memory toAddressBytes, uint amount) = abi.decode(_payload, (uint16, bytes, bytes, uint));

        address to = toAddressBytes.toAddress(0);

        _creditTo(_srcChainId, to, amount);
        emit ReceiveFromChain(_srcChainId, from, to, amount);
    }

    function _sendAndCall(address _from, uint16 _dstChainId, bytes memory _toAddress, uint _amount, bytes calldata _payload, uint _dstGasForCall, address payable _refundAddress, address _zroPaymentAddress, bytes memory _adapterParams) internal virtual {
        _checkAdapterParams(_dstChainId, PT_SEND_AND_CALL, _adapterParams, _dstGasForCall);

        _debitFrom(_from, _dstChainId, _toAddress, _amount);

        bytes memory lzPayload = abi.encode(PT_SEND_AND_CALL, abi.encodePacked(_from), _toAddress, _amount, _payload, _dstGasForCall);
        _lzSend(_dstChainId, lzPayload, _refundAddress, _zroPaymentAddress, _adapterParams, msg.value);

        emit SendToChain(_dstChainId, _from, _toAddress, _amount);
    }

    function _sendAndCallAck(uint16 _srcChainId, bytes memory _srcAddress, uint64 _nonce, bytes memory _payload) internal virtual {
        (, bytes memory from, bytes memory toAddressBytes, uint amount, bytes memory payload, uint gasForCall) = abi.decode(_payload, (uint16, bytes, bytes, uint, bytes, uint));

        address to = toAddressBytes.toAddress(0);

        _creditTo(_srcChainId, to, amount);
        emit ReceiveFromChain(_srcChainId, from, to, amount);

        // todo: should we separate the token receiver and the receiver contract?
        if (!_isContract(to)) {
            emit NonContractAddress(to);
            return;
        }

        _safeCallOnOFTReceived(_srcChainId, _srcAddress, _nonce, from, to, amount, payload, gasForCall);
    }

    function _safeCallOnOFTReceived(uint16 _srcChainId, bytes memory _srcAddress, uint64 _nonce, bytes memory _from, address _to, uint _amount, bytes memory _payload, uint _gasForCall) internal virtual {
        (bool success, bytes memory reason) = _to.excessivelySafeCall(_gasForCall, 80, abi.encodeWithSelector(IOFTReceiver.onOFTReceived.selector, _srcChainId, _srcAddress, _nonce, _from, _amount, _payload));
        if (!success) {
            failedOFTReceivedMessages[_srcChainId][_srcAddress][_nonce] = keccak256(abi.encode(_from, _to, _amount, _payload));
            emit CallOFTReceivedFailure(_srcChainId, _srcAddress, _nonce, _from, _to, _amount, _payload, reason);
        } else {
            bytes32 hash = keccak256(abi.encode(_from, _to, _amount, _payload));
            emit CallOFTReceivedSuccess(_srcChainId, _srcAddress, _nonce, hash);
        }
    }

    function _checkAdapterParams(uint16 _dstChainId, uint16 _pkType, bytes memory _adapterParams, uint _extraGas) internal virtual {
        if (useCustomAdapterParams) {
            _checkGasLimit(_dstChainId, _pkType, _adapterParams, _extraGas);
        } else {
            require(_adapterParams.length == 0, "OFTCore: _adapterParams must be empty.");
        }
    }

    function _isContract(address _account) internal view returns (bool) {
        return _account.code.length > 0;
    }

    function _debitFrom(address _from, uint16 _dstChainId, bytes memory _toAddress, uint _amount) internal virtual;

    function _creditTo(uint16 _srcChainId, address _toAddress, uint _amount) internal virtual;
}
