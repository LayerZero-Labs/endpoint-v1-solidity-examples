// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.4;
pragma abicoder v2;

import "../interfaces/ILayerZeroReceiver.sol";
import "../interfaces/ILayerZeroEndpoint.sol";

// MOCK
// heavily mocked LayerZero endpoint to facilitate same chain testing of two UserApplications
contract LayerZeroEndpointMock is ILayerZeroEndpoint {

    // inboundNonce = [srcChainId][srcAddress].
    mapping(uint16 => mapping(bytes => uint64)) public inboundNonce;
    // outboundNonce = [dstChainId][srcAddress].
    mapping(uint16 => mapping(address => uint64)) public outboundNonce;

    uint16 public endpointId;
    uint public nativeFee;
    uint public zroFee;
    uint16 public sendVersion;
    uint16 public receiveVersion;

    constructor(){
        endpointId = 1;
        sendVersion = 1;
        receiveVersion = 1;
    }

    // mock helper to set the value returned by `estimateNativeFees`
    function setEstimatedFees(uint _nativeFee, uint _zroFee) public {
        nativeFee = _nativeFee;
        zroFee = _zroFee;
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
            nonce = outboundNonce[_chainId][destAddr]++;
        }

        bytes memory bytesSourceUserApplicationAddr = addrToPackedBytes(address(msg.sender)); // cast this address to bytes
        ILayerZeroReceiver(destAddr).lzReceive(_chainId, bytesSourceUserApplicationAddr, nonce, _payload); // invoke lzReceive
    }

    // @notice gets a quote in source native gas, for the amount that send() requires to pay for message delivery
    // @param _dstChainId - the destination chain identifier
    // @param _userApplication - the user app address on this EVM chain
    // @param _payload - the custom message to send over LayerZero
    // @param _payInZRO - if false, user app pays the protocol fee in native token
    // @param _adapterParam - parameters for the adapter service, e.g. send some dust native token to dstChain
    function estimateFees(
        uint16 _dstChainId,
        address _userApplication,
        bytes calldata _payload,
        bool _payInZRO,
        bytes calldata _adapterParam
    ) external override view returns (uint _nativeFee, uint _zroFee){
        _nativeFee = nativeFee;
        _zroFee = zroFee;
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

    // Define what library the UA points too
    function setSendVersion(uint16 _newVersion) external override {
        sendVersion = _newVersion;
    }

    function setReceiveVersion(uint16 _newVersion) external override {
        receiveVersion = _newVersion;
    }

    function forceResumeReceive(uint16 _srcChainId, bytes calldata _srcAddress) external override {
        //
    }

    function getInboundNonce(uint16 _chainID, bytes calldata _srcAddress) external view override returns (uint64) {
        return inboundNonce[_chainID][_srcAddress];
    }

    function getOutboundNonce(uint16 _chainID, address _srcAddress) external view override returns (uint64) {
        return outboundNonce[_chainID][_srcAddress];
    }

    function getEndpointId() external view override returns (uint16) {
        return endpointId;
    }

    function getSendVersion() external view override returns (uint16) {
        return 1;
    }

    function getReceiveVersion() external view override returns (uint16) {
        return 1;
    }

    function setConfig(
        uint16, /*_dstChainId*/
        uint _configType,
        bytes memory _config
    ) external override {
        //endpoint.setConfig(endpoint.getSendVersion(), _configType, _config);
    }

    function getConfig(
        uint16, /*_dstChainId*/
        uint16 _chainId,
        address,
        uint _configType
    ) external view override returns (bytes memory) {
        //return endpoint.getConfig(endpoint.getSendVersion(), _chainId, address(this), _configType);
    }

    function isValidSendLibrary(address _ua, address _libraryAddress) external view override returns (bool) {
        // LibraryConfig storage uaConfig = uaConfigLookup[_ua];
        // address sendLib = address(uaConfig.sendVersion == DEFAULT_VERSION ? defaultSendLibrary : uaConfig.sendLibrary);
        // return sendLib == _libraryAddress;
    }

    function isValidReceiveLibrary(address _ua, address _libraryAddress) external view override returns (bool) {
        // LibraryConfig storage uaConfig = uaConfigLookup[_ua];
        // address receiveLib = uaConfig.receiveVersion == DEFAULT_VERSION ? defaultReceiveLibraryAddress : uaConfig.receiveLibraryAddress;
        // return receiveLib == _libraryAddress;
    }

    function hasStoredPayload(uint16 _srcChainId, bytes calldata _srcAddress, address _dstAddress) external view override returns (bool) {
        // StoredPayload storage sp = storedPayload[_srcChainId][_srcAddress][_dstAddress];
        // return sp.stored;
        return false;
    }

    function retryPayload(uint16 _srcChainId, bytes calldata _srcAddress, address _dstAddress) external override {
        // mocked, ignore. will never happen
    }

}

