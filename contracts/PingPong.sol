//
// Note: you will need to fund each deployed contract with gas
//
// PingPong sends a LayerZero message back and forth between chains until stopped!
//
// Demonstrates:
//  1. a recursive feature of calling send() from inside lzReceive()
//  2. how to `estimateFees` for a send()'ing a LayerZero message
//  3. the contract pays the message fee

pragma solidity ^0.8.4;

import "./interfaces/ILayerZeroReceiver.sol";
import "./interfaces/ILayerZeroEndpoint.sol";
import "./interfaces/ILayerZeroUserApplicationConfig.sol";

contract PingPong is ILayerZeroReceiver, ILayerZeroUserApplicationConfig {
    // the LayerZero endpoint calls .send() to send a cross chain message
    ILayerZeroEndpoint public endpoint;
    // whether PingPong is ping-ponging
    bool public pingsEnabled;
    // event emitted every ping() to keep track of consecutive pings count
    event Ping(uint pings);
    // keep track of the totalPings sent
    uint public numPings;

    // constructor requires the LayerZero endpoint for this chain
    constructor(address _layerZeroEndpoint){
        pingsEnabled = true;
        endpoint = ILayerZeroEndpoint(_layerZeroEndpoint);
    }

    // disable ping-ponging
    function disable() external {
        pingsEnabled = false;
    }

    // pings the destination chain, along with the current number of pings sent
    function ping(
        uint16 _dstChainId,                 // send a ping to this destination chainId
        address _dstPingPongAddr,           // destination address of PingPong contract
        uint pings                          // the uint to start at. use 0 as a default
    )
    public
    {
        require(address(this).balance > 0, "the balance of this contract is 0. pls send gas for message fees");
        require(pingsEnabled, "pingsEnabled is false. messages stopped");

        emit Ping(pings);

        // abi.encode() the payload with the number of pings sent
        bytes memory payload = abi.encode(pings);

        // get the fees we need to pay to LayerZero + Relayer to cover message delivery
        // see Communicator.sol's .estimateNativeFees() function for more details.
        (uint messageFee, ) = endpoint.estimateFees(_dstChainId, address(this), payload, false, bytes(""));
        require(address(this).balance >= messageFee, "address(this).balance < messageFee. pls send gas for message fees");

        // send LayerZero message
        endpoint.send{value:messageFee}(            // {value: messageFee} will be paid out of this contract!
            _dstChainId,                            // destination chainId
            abi.encodePacked(_dstPingPongAddr),     // destination address of PingPong
            payload,                                // abi.encode()'ed bytes
            payable(msg.sender),                    // (msg.sender will be this contract) refund address (LayerZero will refund any extra gas back to caller of send()
            address(0x0),                           // 'zroPaymentAddress' unused for this mock/example
            bytes("")                               // 'txParameters' unused for this mock/example
        );
    }

    // receive the bytes payload from the source chain via LayerZero
    // _srcChainId: the chainId that we are receiving the message from.
    // _fromAddress: the source PingPong address
    function lzReceive(uint16 _srcChainId, bytes memory _fromAddress, uint64 _nonce, bytes memory _payload) override external{
        require(msg.sender == address(endpoint)); // boilerplate! lzReceive must be called by the endpoint for security

        // use assembly to extract the address from the bytes memory parameter
        address fromAddress;
        assembly { fromAddress := mload(add(_fromAddress, 20)) }

        // decode the number of pings sent thus far
        (uint pings) = abi.decode(_payload, (uint));

        // "recursively" call ping in order to *pong*     (and increment pings)
        ++pings;
        numPings = pings;
        ping(_srcChainId, fromAddress, pings);
    }

    function setConfig(
        uint16, /*_dstChainId*/
        uint _configType,
        bytes memory _config
    ) external override {
        endpoint.setConfig(endpoint.getSendVersion(), _configType, _config);
    }

    function getConfig(
        uint16, /*_dstChainId*/
        uint16 _chainId,
        address,
        uint _configType
    ) external view override returns (bytes memory) {
        return endpoint.getConfig(endpoint.getSendVersion(), _chainId, address(this), _configType);
    }

    function setSendVersion(uint16 version) external override {
        endpoint.setSendVersion(version);
    }

    function setReceiveVersion(uint16 version) external override {
        endpoint.setReceiveVersion(version);
    }

    function getSendVersion() external view override returns (uint16) {
        return endpoint.getSendVersion();
    }

    function getReceiveVersion() external view override returns (uint16) {
        return endpoint.getReceiveVersion();
    }

    function forceResumeReceive(uint16 _srcChainId, bytes calldata _srcAddress) external override {
        // do nth
    }

    // allow this contract to receive ether
    fallback() external payable {}
    receive() external payable {}

}