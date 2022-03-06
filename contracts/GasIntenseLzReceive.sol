// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.4;
pragma abicoder v2;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "./interfaces/ILayerZeroReceiver.sol";
import "./interfaces/ILayerZeroEndpoint.sol";
import "./interfaces/ILayerZeroUserApplicationConfig.sol";
import "./OmniCounter.sol";

contract GasIntenseLzReceive is ILayerZeroReceiver, ILayerZeroUserApplicationConfig {
    // keep track of how many lzReceive's have succeeded
    uint public messageCounter;
    // required: the LayerZero endpoint which is passed in the constructor
    ILayerZeroEndpoint public endpoint;
    // list of OmniCounter instances deploy by this contract
    OmniCounter[] public omniCounters; // each OmniCounter costs roughly 2m gas to deploy

    constructor(address _endpoint) {
        endpoint = ILayerZeroEndpoint(_endpoint);
    }

    function getCounter() public view returns (uint) {
        return omniCounters.length;
    }

    function deployOmniCounter() public {
        OmniCounter omniCounter = new OmniCounter(address(endpoint));
        omniCounters.push(omniCounter);
    }

    // overrides lzReceive function in ILayerZeroReceiver.
    // automatically invoked on the receiving chain after the source chain calls endpoint.send(...)
    function lzReceive(
        uint16,
        bytes memory, /*_fromAddress*/
        uint64, /*_nonce*/
        bytes memory /*_payload*/
    ) external override {
        require(msg.sender == address(endpoint));

        // deploy an OmniCounter - consumes a lot more gas than the default settings.
        // this means you will have to have sent the source message using _adapterParams
        // that specified more the default amount of gas.
        deployOmniCounter();
    }

    // Deploy an OmniCounter on the remote chain, uses _adapterParams (v1)
    function deployRemote(uint16 _dstChainId, bytes calldata _dstCounterMockAddress, uint gasAmountForDst) public payable {
        uint16 version = 1;
        bytes memory _relayerParams = abi.encodePacked(
            version,
            gasAmountForDst
        );
        endpoint.send{value: msg.value}(_dstChainId, _dstCounterMockAddress, bytes(""), payable(msg.sender), address(0x0), _relayerParams);
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

}
