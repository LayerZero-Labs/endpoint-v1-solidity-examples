// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.4;

// an interface for the two primary methods of a LayerZero endpoint:
//    - send()
//    - estimateNativeFees()
interface ILayerZeroEndpoint {

    function send(
        uint16 _chainId,
        bytes calldata _destination,
        bytes calldata _payload,
        address payable refundAddress,
        address _zroPaymentAddress,
        bytes calldata txParameters
    ) external payable;

    function estimateNativeFees(
        uint16 chainId,
        address userApplication,
        bytes calldata payload,
        bool payInZRO,
        bytes calldata txParameters
    ) view external returns(uint totalFee);

}
