// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.4;
pragma experimental ABIEncoderV2;

import "../interfaces/ILayerZeroReceiver.sol";
import "../interfaces/ILayerZeroEndpoint.sol";

// MOCK
// heavily mocked LayerZero endpoint to facilitate same chain testing of two UserApplications
contract LayerZeroEndpointMock is ILayerZeroEndpoint {

    mapping(uint16 => mapping(address => uint64)) public nonceMap;
    uint public estimatedNativeFee;

    constructor(){}

    // mock helper to set the value returned by `estimateNativeFees`
    function setTheEstimatedNativeFee(uint _newFee) public {
        estimatedNativeFee = _newFee;
    }

    // The user application on chain A (the source, or "from" chain) sends a message
    // to the communicator. It includes the following information:
    //      _chainId            - the destination chain identifier
    //      _destination        - the destination chain address (in bytes)
    //      _payload            - a the custom data to send
    //      _refundAddress      - address to send remainder funds to
    //      _zroPaymentAddress  - if 0x0, implies user app is paying in native token. otherwise
    //      txParameters        - optional data passed to the relayer via getPrices()
    function send(
        uint16 _chainId,
        bytes calldata _destination,
        bytes calldata _payload,
        address payable _refundAddress,
        address _zroPaymentAddress,
        bytes calldata txParameters
    ) override external payable {

        address destAddr = packedBytesToAddr(_destination);
        uint64 nonce;
        {
            nonce = nonceMap[_chainId][destAddr]++;
        }

        bytes memory bytesSourceUserApplicationAddr = addrToPackedBytes(address(msg.sender)); // cast this address to bytes
        ILayerZeroReceiver(destAddr).lzReceive(_chainId, bytesSourceUserApplicationAddr, nonce, _payload); // invoke lzReceive
    }

    // override from ILayerZeroEndpoint
    function estimateNativeFees(
        uint16 _chainId,
        address userApplication,
        bytes calldata _payload,
        bool payInZRO,
        bytes calldata txParameters
    ) override view external returns(uint totalFee) {
        return estimatedNativeFee;
    }

    function packedBytesToAddr(bytes calldata _b) public pure returns (address){
        address addr;
        assembly {
            let ptr := mload(0x40)
            calldatacopy(ptr, sub(_b.offset, 2 ), add(_b.length, 2))
            addr := mload(sub(ptr,10))
        }
        return addr;
    }

    function addrToPackedBytes(address _a) public pure returns (bytes memory){
        bytes memory data = abi.encodePacked(_a);
        return data;
    }

}

