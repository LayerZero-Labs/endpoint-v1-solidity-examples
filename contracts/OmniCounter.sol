// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.4;
pragma abicoder v2;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/ILayerZeroReceiver.sol";
import "./interfaces/ILayerZeroEndpoint.sol";
import "./interfaces/ILayerZeroUserApplicationConfig.sol";

contract OmniCounter is Ownable, ILayerZeroReceiver, ILayerZeroUserApplicationConfig {
    using SafeMath for uint;
    // keep track of how many messages have been received from other chains
    uint public messageCounter;
    // required: the LayerZero endpoint which is passed in the constructor
    ILayerZeroEndpoint public endpoint;
    mapping(uint16 => bytes) public remotes;

    constructor(address _endpoint) {
        endpoint = ILayerZeroEndpoint(_endpoint);
    }

    function getCounter() public view returns (uint) {
        return messageCounter;
    }

    // overrides lzReceive function in ILayerZeroReceiver.
    // automatically invoked on the receiving chain after the source chain calls endpoint.send(...)
    function lzReceive(
        uint16 _srcChainId,
        bytes memory _srcAddress,
        uint64, /*_nonce*/
        bytes memory /*_payload*/
    ) external override {
        // boilerplate: only allow this endpiont to be the caller of lzReceive!
        require(msg.sender == address(endpoint));
        // owner must have setRemote() to allow its remote contracts to send to this contract
        require(
            _srcAddress.length == remotes[_srcChainId].length && keccak256(_srcAddress) == keccak256(remotes[_srcChainId]),
            "Invalid remote sender address. owner should call setRemote() to enable remote contract"
        );

        messageCounter += 1;
    }

    // custom function that wraps endpoint.send(...) which will
    // cause lzReceive() to be called on the destination chain!
    function incrementCounter(uint16 _dstChainId, bytes calldata _dstCounterMockAddress) public payable {
        endpoint.send{value: msg.value}(_dstChainId, _dstCounterMockAddress, bytes(""), payable(msg.sender), address(0x0), bytes(""));
    }

    // _adapterParams (v1)
    // customize the gas amount to be used on the destination chain.
    function incrementCounterWithAdapterParamsV1(uint16 _dstChainId, bytes calldata _dstCounterMockAddress, uint gasAmountForDst) public payable {
        uint16 version = 1;
        // make look like this: 0x00010000000000000000000000000000000000000000000000000000000000030d40
        bytes memory _adapterParams = abi.encodePacked(
            version,
            gasAmountForDst
        );
        endpoint.send{value: msg.value}(_dstChainId, _dstCounterMockAddress, bytes(""), payable(msg.sender), address(0x0), _adapterParams);
    }

    // _adapterParams (v2)
    // specify a small amount of notive token you want to airdropped to your wallet on destination
    function incrementCounterWithAdapterParamsV2(uint16 _dstChainId, bytes calldata _dstCounterMockAddress, uint gasAmountForDst, uint airdropEthQty, address airdropAddr) public payable {
        uint16 version = 2;
        bytes memory _adapterParams = abi.encodePacked(
            version,
            gasAmountForDst,
            airdropEthQty,      // how must dust to receive on destination
            airdropAddr         // the address to receive the dust
        );
        endpoint.send{value: msg.value}(_dstChainId, _dstCounterMockAddress, bytes(""), payable(msg.sender), address(0x0), _adapterParams);
    }

    // call send() to multiple destinations in the same transaction!
    function incrementMultiCounter(uint16[] calldata _dstChainIds, bytes[] calldata _dstCounterMockAddresses, address payable _refundAddr) public payable {
        require(_dstChainIds.length == _dstCounterMockAddresses.length, "_dstChainIds.length, _dstCounterMockAddresses.length not the same");

        uint numberOfChains = _dstChainIds.length;

        // note: could result in a few wei of dust left in contract
        uint valueToSend = msg.value.div(numberOfChains);

        // send() each chainId + dst address pair
        for (uint i = 0; i < numberOfChains; ++i) {
            // a Communicator.sol instance is the 'endpoint'
            // .send() each payload to the destination chainId + UA destination address
            endpoint.send{value: valueToSend}(_dstChainIds[i], _dstCounterMockAddresses[i], bytes(""), _refundAddr, address(0x0), bytes(""));
        }

        // refund eth if too much was sent into this contract call
        uint refund = msg.value.sub(valueToSend.mul(numberOfChains));
        _refundAddr.transfer(refund);
    }

    function setConfig(
        uint16, /*_version*/
        uint16 _chainId,
        uint _configType,
        bytes calldata _config
    ) external override {
        endpoint.setConfig(endpoint.getSendVersion(address(this)), _chainId, _configType, _config);
    }

    function getConfig(
        uint16, /*_dstChainId*/
        uint16 _chainId,
        address,
        uint _configType
    ) external view returns (bytes memory) {
        return endpoint.getConfig(endpoint.getSendVersion(address(this)), _chainId, address(this), _configType);
    }

    function setSendVersion(uint16 version) external override {
        endpoint.setSendVersion(version);
    }

    function setReceiveVersion(uint16 version) external override {
        endpoint.setReceiveVersion(version);
    }

    function getSendVersion() external view returns (uint16) {
        return endpoint.getSendVersion(address(this));
    }

    function getReceiveVersion() external view returns (uint16) {
        return endpoint.getReceiveVersion(address(this));
    }

    function forceResumeReceive(uint16 _srcChainId, bytes calldata _srcAddress) external override {
        //
    }

    // set the Oracle to be used by this UA for LayerZero messages
    function setOracle(uint16 dstChainId, address oracle) external {
        uint TYPE_ORACLE = 6; // from UltraLightNode
        // set the Oracle
        endpoint.setConfig(
            endpoint.getSendVersion(address(this)),
            dstChainId,
            TYPE_ORACLE,
            abi.encode(oracle)
        );
    }

    // _chainId - the chainId for the remote contract
    // _remoteAddress - the contract address on the remote chainId
    // the owner must set remote contract addresses.
    // in lzReceive(), a require() ensures only messages
    // from known contracts can be received.
    function setRemote(uint16 _chainId, bytes calldata _remoteAddress) external onlyOwner {
        require(remotes[_chainId].length == 0, "The remote address has already been set for the chainId!");
        remotes[_chainId] = _remoteAddress;
    }

    // set the inbound block confirmations
    function setInboundConfirmations(uint16 remoteChainId, uint16 confirmations) external {
        endpoint.setConfig(
            endpoint.getSendVersion(address(this)),
            remoteChainId,
            2, // CONFIG_TYPE_INBOUND_BLOCK_CONFIRMATIONS
            abi.encode(confirmations)
        );
    }

    // set outbound block confirmations
    function setOutboundConfirmations(uint16 remoteChainId, uint16 confirmations) external {
        endpoint.setConfig(
            endpoint.getSendVersion(address(this)),
            remoteChainId,
            5, // CONFIG_TYPE_OUTBOUND_BLOCK_CONFIRMATIONS
            abi.encode(confirmations)
        );
    }

    // allow this contract to receive ether
    fallback() external payable {}
    receive() external payable {}
}