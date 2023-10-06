// SPDX-License-Identifier: MIT

//
// Note: you will need to fund each deployed contract with gas
//
// PingPong sends a LayerZero message back and forth between chains
// until it is paused or runs out of gas!
//
// Demonstrates:
//  1. a recursive feature of calling send() from inside lzReceive()
//  2. how to `estimateFees` for a send()'ing a LayerZero message
//  3. the contract pays the message fee

pragma solidity ^0.8.0;
pragma abicoder v2;

import "../lzApp/NonblockingLzApp.sol";

contract PingPong is NonblockingLzApp {
    // event emitted every ping() to keep track of consecutive pings count
    event Ping(uint pings);

    // constructor requires the LayerZero endpoint for this chain
    constructor(address _endpoint) NonblockingLzApp(_endpoint) {}

    // pings the destination chain, along with the current number of pings sent
    function ping(
        uint16 _dstChainId
    ) public {
        _ping(_dstChainId, 0);
    }

    // pings the destination chain, along with the current number of pings sent
    function _ping(
        uint16 _dstChainId,
        uint _ping
    ) internal {
        require(address(this).balance > 0, "This contract ran out of money.");

        // encode the payload with the number of pings
        bytes memory payload = abi.encode(_ping);

        uint16 version = 1;
        uint256 gasForDestinationLzReceive = 350000;
        bytes memory adapterParams = abi.encodePacked(version, gasForDestinationLzReceive);

        // send LayerZero message
        _lzSend( // {value: messageFee} will be paid out of this contract!
            _dstChainId, // destination chainId
            payload, // abi.encode()'ed bytes
            payable(this), // (msg.sender will be this contract) refund address (LayerZero will refund any extra gas back to caller of send()
            address(0x0), // future param, unused for this example
            adapterParams, // v1 adapterParams, specify custom destination gas qty
            address(this).balance
        );
    }

    function _nonblockingLzReceive(
        uint16 _srcChainId,
        bytes memory _srcAddress,
        uint64, /*_nonce*/
        bytes memory _payload
    ) internal override {
        // decode the number of pings sent thus far
        uint pings = abi.decode(_payload, (uint)) + 1;
        emit Ping(pings);

        // *pong* back to the other side
        _ping(_srcChainId,pings);
    }

    // allow this contract to receive ether
    receive() external payable {}
}
