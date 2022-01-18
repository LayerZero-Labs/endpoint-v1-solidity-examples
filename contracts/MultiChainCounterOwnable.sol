// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/ILayerZeroReceiver.sol";
import "./interfaces/ILayerZeroEndpoint.sol";
import "./libraries/BytesLib.sol";

// A classic "counter" example with a twist.
// Deploy two instances of this contract and call incrementCounter()
// to increment the messageCounter on the destination contract!
contract MultiChainCounterOwnable is ILayerZeroReceiver, Ownable {
    using BytesLib for bytes;

    // keep track of how many messages have been received from other chains
    uint public messageCounter;

    // required: the LayerZero endpoint which is passed in the constructor
    ILayerZeroEndpoint public endpoint;

    // a map of our connected contracts
    mapping(uint16 => bytes) public destinationContractAddresses;

    // required: the LayerZero endpoint
    constructor(address _endpoint) {
        endpoint = ILayerZeroEndpoint(_endpoint);
    }

    // set this contract to know about a remote contract on a remote chainId
    function setDestination(uint16 chainId, bytes calldata destinationContractAddress) public onlyOwner {
        destinationContractAddresses[chainId] = destinationContractAddress;
    }

    // overrides lzReceive function in ILayerZeroReceiver.
    // automatically invoked on the receiving chain after the source chain calls endpoint.send(...)
    function lzReceive(uint16 _sourceChainId, bytes memory _sourceContractAddress, uint64 , bytes memory ) override external {
        require(msg.sender == address(endpoint));
        require(_sourceContractAddress.equals(destinationContractAddresses[_sourceChainId]), "sending contract not allowed");
        messageCounter += 1;
    }

    // custom function that wraps endpoint.send(...) which will
    // cause lzReceive() to be called on the destination chain!
    function incrementCounter(uint16 _dstChainId) public payable {

        require(destinationContractAddresses[_dstChainId].length != 0, "Cant send to the specified _dstChainId. It hasnt been configured");

        endpoint.send{value:msg.value}(
            _dstChainId,
            destinationContractAddresses[_dstChainId],
            bytes(""),
            payable(msg.sender),
            address(0x0),
            bytes("")
        );
    }

}
