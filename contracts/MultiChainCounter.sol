// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.4;

import "./interfaces/ILayerZeroReceiver.sol";
import "./interfaces/ILayerZeroEndpoint.sol";

contract MultiChainCounter is ILayerZeroReceiver {

    // keep track of how many messages have been received from other chains
    uint public messageCounter;

    // required: the LayerZero endpoint which is passed in the constructor
    ILayerZeroEndpoint public endpoint;

    // required: the LayerZero endpoint
    constructor(address _endpoint)  {
        endpoint = ILayerZeroEndpoint(_endpoint);
    }

    // overrides lzReceive function in ILayerZeroReceiver.
    // automatically invoked on the receiving chain after the source chain calls endpoint.send(...)
    function lzReceive(uint16 , bytes memory , uint64 , bytes memory ) override external {
        require(msg.sender == address(endpoint));
        messageCounter += 1;
    }

    // custom function that wraps endpoint.send(...) which will
    // cause lzReceive() to be called on the destination chain!
    function incrementCounter(uint16 _dstChainId, bytes calldata _dstCounterMockAddress) public payable {
        endpoint.send{value:msg.value}(
            _dstChainId,
            _dstCounterMockAddress,
            bytes(""),
            payable(msg.sender),
            address(0x0),
            bytes("")
        );
    }

}