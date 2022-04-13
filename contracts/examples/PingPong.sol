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

pragma solidity 0.8.4;
pragma abicoder v2;

import "@openzeppelin/contracts/security/Pausable.sol";
import "../lzApp/NonblockingLzApp.sol";

contract PingPong is NonblockingLzApp, Pausable {
    // event emitted every ping() to keep track of consecutive pings count
    event Ping(uint pings);

    // constructor requires the LayerZero endpoint for this chain
    constructor(address _endpoint) NonblockingLzApp(_endpoint) {}

    // disable ping-ponging
    function enable(bool en) external {
        if (en) {
            _pause();
        } else {
            _unpause();
        }
    }

    // pings the destination chain, along with the current number of pings sent
    function ping(
        uint16 _dstChainId, // send a ping to this destination chainId
        address _dstPingPongAddr, // destination address of PingPong contract
        uint pings // the number of pings
    ) public whenNotPaused {
        require(this.isTrustedRemote(_dstChainId, abi.encodePacked(_dstPingPongAddr)), "you must allow inbound messages to ALL contracts with setTrustedRemote()");
        require(address(this).balance > 0, "the balance of this contract is 0. pls send gas for message fees");

        emit Ping(++pings);

        // encode the payload with the number of pings
        bytes memory payload = abi.encode(pings);

        // use adapterParams v1 to specify more gas for the destination
        uint16 version = 1;
        uint gasForDestinationLzReceive = 350000;
        bytes memory adapterParams = abi.encodePacked(version, gasForDestinationLzReceive);

        // get the fees we need to pay to LayerZero for message delivery
        (uint messageFee, ) = lzEndpoint.estimateFees(_dstChainId, address(this), payload, false, adapterParams);
        require(address(this).balance >= messageFee, "address(this).balance < messageFee. fund this contract with more ether");

        // send LayerZero message
        lzEndpoint.send{value: messageFee}( // {value: messageFee} will be paid out of this contract!
            _dstChainId, // destination chainId
            abi.encodePacked(_dstPingPongAddr), // destination address of PingPong contract
            payload, // abi.encode()'ed bytes
            payable(this), // (msg.sender will be this contract) refund address (LayerZero will refund any extra gas back to caller of send()
            address(0x0), // future param, unused for this example
            adapterParams // v1 adapterParams, specify custom destination gas qty
        );
    }

    function _nonblockingLzReceive(
        uint16 _srcChainId,
        bytes memory _srcAddress,
        uint64, /*_nonce*/
        bytes memory _payload
    ) internal override {
        // use assembly to extract the address from the bytes memory parameter
        address sendBackToAddress;
        assembly {
            sendBackToAddress := mload(add(_srcAddress, 20))
        }

        // decode the number of pings sent thus far
        uint pings = abi.decode(_payload, (uint));

        // *pong* back to the other side
        ping(_srcChainId, sendBackToAddress, pings);
    }

    // allow this contract to receive ether
    receive() external payable {}
}
