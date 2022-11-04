// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

import "../IOFTCore.sol";

/**
 * @dev Interface of the composable OFT core standard
 */
interface IComposableOFTCore is IOFTCore {
    function estimateSendAndCallFee(uint16 _dstChainId, bytes calldata _toAddress, uint _amount, bytes calldata _payload, uint64 _dstGasForCall, bool _useZro, bytes calldata _adapterParams) external view returns (uint nativeFee, uint zroFee);

    function sendAndCall(address _from, uint16 _dstChainId, bytes calldata _toAddress, uint _amount, bytes calldata _payload, uint64 _dstGasForCall, address payable _refundAddress, address _zroPaymentAddress, bytes calldata _adapterParams) external payable;

    function retryOFTReceived(uint16 _srcChainId, bytes calldata _srcAddress, uint64 _nonce, bytes calldata _from, address _to, uint _amount, bytes calldata _payload) external;

    event CallOFTReceivedFailure(uint16 indexed _srcChainId, bytes _srcAddress, uint64 _nonce, bytes _from, address indexed _to, uint _amount, bytes _payload, bytes _reason);

    event CallOFTReceivedSuccess(uint16 indexed _srcChainId, bytes _srcAddress, uint64 _nonce, bytes32 _hash);

    event RetryOFTReceivedSuccess(bytes32 _messageHash);

    event NonContractAddress(address _address);
}
