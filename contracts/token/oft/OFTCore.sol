// SPDX-License-Identifier: MIT

pragma solidity ^0.8.2;

import "../../lzApp/NonblockingLzApp.sol";
import "./IOFTCore.sol";
import "./IOFTReceiver.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@nomad-xyz/excessively-safe-call/src/ExcessivelySafeCall.sol";

abstract contract OFTCore is NonblockingLzApp, ERC165, IOFTCore {
    using ExcessivelySafeCall for address;

    uint public constant NO_EXTRA_GAS = 0;

    // packet type
    uint16 public constant PT_SEND = 0;

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

    function sendFrom(address _from, uint16 _dstChainId, bytes memory _toAddress, uint _amount, bytes memory _payload, address payable _refundAddress, address _zroPaymentAddress, bytes memory _adapterParams) public payable virtual override {
        _send(_from, _dstChainId, _toAddress, _amount, _payload, _refundAddress, _zroPaymentAddress, _adapterParams);
    }

    function retryOFTReceived(uint16 _srcChainId, bytes calldata _srcOFTAddress, uint64 _nonce, bytes calldata _fromAddress, address _to, uint _amount, bytes calldata _payload) public virtual override {
        bytes32 failedMessageHash = failedOFTReceivedMessages[_srcChainId][_srcOFTAddress][_nonce];
        require(failedMessageHash != bytes32(0), "OFTCore: no failed message to retry");

        bytes32 hash = keccak256(abi.encode(_fromAddress, _to, _amount, _payload));
        require(hash == failedMessageHash, "OFTCore: failed message hash mismatch");

        delete failedOFTReceivedMessages[_srcChainId][_srcOFTAddress][_nonce];
        IOFTReceiver(_to).onOFTReceived(_srcChainId, _srcOFTAddress, _nonce, _fromAddress, _amount, _payload);
        emit RetryOFTReceivedSuccess(_srcChainId, _srcOFTAddress, _nonce, _fromAddress, _to, _amount, _payload);
    }

    function setUseCustomAdapterParams(bool _useCustomAdapterParams) public virtual onlyOwner {
        useCustomAdapterParams = _useCustomAdapterParams;
        emit SetUseCustomAdapterParams(_useCustomAdapterParams);
    }

    function _nonblockingLzReceive(uint16 _srcChainId, bytes memory _srcAddress, uint64 _nonce, bytes memory _payload) internal virtual override {
        // decode and load the toAddress
        (bytes memory sender, bytes memory toAddressBytes, uint amount, bytes memory payload) = abi.decode(_payload, (bytes, bytes, uint, bytes));

        require(toAddressBytes.length == 20, "OFTCore: invalid to address");
        if (toAddressBytes.length != 20) {
            emit InvalidToAddress(toAddressBytes);
            return;
        }

        address to;
        assembly {
            to := mload(add(toAddressBytes, 20))
        }

        _creditTo(_srcChainId, to, amount);
        emit ReceiveFromChain(_srcChainId, sender, to, amount);

        // call oftReceive() on the toAddress if it is a contract
        if (_isContract(to)) {
            (bool success, bytes memory reason) = to.excessivelySafeCall(gasleft(), 80, abi.encodeWithSelector(IOFTReceiver.onOFTReceived.selector, _srcChainId, _srcAddress, _nonce, sender, amount, payload));
            if (!success) {
                // todo: how about OOG?
                // if transfer to non IOFTReceiver implementer, ignore it
                if (reason.length == 0) {
                    return;
                }

                failedOFTReceivedMessages[_srcChainId][_srcAddress][_nonce] = keccak256(abi.encode(sender, to, amount, payload));
                emit CallOFTReceivedFailed(_srcChainId, _srcAddress, _nonce, sender, to, amount, payload, reason);
            }
        }
    }

    function _send(address _from, uint16 _dstChainId, bytes memory _toAddress, uint _amount, bytes memory _payload, address payable _refundAddress, address _zroPaymentAddress, bytes memory _adapterParams) internal virtual {
        _debitFrom(_from, _dstChainId, _toAddress, _amount);

        bytes memory lzPayload = abi.encode(abi.encodePacked(_from), _toAddress, _amount, _payload);

        if (useCustomAdapterParams) {
            _checkGasLimit(_dstChainId, PT_SEND, _adapterParams, NO_EXTRA_GAS);
        } else {
            require(_adapterParams.length == 0, "OFTCore: _adapterParams must be empty.");
        }
        _lzSend(_dstChainId, lzPayload, _refundAddress, _zroPaymentAddress, _adapterParams, msg.value);

        emit SendToChain(_dstChainId, _from, _toAddress, _amount);
    }

    function _isContract(address _account) internal view returns (bool) {
        return _account.code.length > 0;
    }

    function _debitFrom(address _from, uint16 _dstChainId, bytes memory _toAddress, uint _amount) internal virtual;

    function _creditTo(uint16 _srcChainId, address _toAddress, uint _amount) internal virtual;
}
