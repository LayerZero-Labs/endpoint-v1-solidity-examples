// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.4;
pragma abicoder v2;

import "../interfaces/ILayerZeroReceiver.sol";
import "../interfaces/ILayerZeroEndpoint.sol";

/*
mocking multi endpoint connection.
- send() will short circuit to lzReceive() directly
- no reentrancy guard. the real LayerZero endpoint on main net has a send and receive guard, respectively.
if we run a ping-pong-like application, the recursive call might use all gas limit in the block.
- not using any messaging library, hence all messaging library func, e.g. estimateFees, version, will not work
*/
contract LZEndpointMock is ILayerZeroEndpoint {
    mapping(address => address) public lzEndpointLookup;

    uint16 public mockChainId;
    address payable public mockOracle;
    address payable public mockRelayer;
    uint public mockBlockConfirmations;
    uint16 public mockLibraryVersion;
    uint public mockStaticNativeFee;
    uint16 public mockLayerZeroVersion;
    uint public nativeFee;
    uint public zroFee;

    // inboundNonce = [srcChainId][srcAddress].
    mapping(uint16 => mapping(bytes => uint64)) public inboundNonce;
    // outboundNonce = [dstChainId][srcAddress].
    mapping(uint16 => mapping(address => uint64)) public outboundNonce;

    constructor(uint16 _chainId) {
        mockStaticNativeFee = 42;
        mockLayerZeroVersion = 1;
        mockChainId = _chainId;
    }

    // mock helper to set the value returned by `estimateNativeFees`
    function setEstimatedFees(uint _nativeFee, uint _zroFee) public {
        nativeFee = _nativeFee;
        zroFee = _zroFee;
    }

    function getChainId() external view override returns (uint16) {
        return mockChainId;
    }

    function setDestLzEndpoint(address destAddr, address lzEndpointAddr) external {
        lzEndpointLookup[destAddr] = lzEndpointAddr;
    }

    function send(
        uint16 _chainId,
        bytes calldata _destination,
        bytes calldata _payload,
        address payable, /* _refundAddress*/
        address, /*_zroPaymentAddress*/
        bytes memory _adapterParams
    ) external payable override {
        address destAddr = packedBytesToAddr(_destination);
        address lzEndpoint = lzEndpointLookup[destAddr];

        require(lzEndpoint != address(0), "LayerZeroMock: destination LayerZero Endpoint not found");

        uint64 nonce;
        {
            nonce = ++outboundNonce[_chainId][msg.sender];
        }

        // Mock the relayer paying the dstNativeAddr the amount of extra native token
        {
            uint dstNative;
            address dstNativeAddr;
            assembly {
                dstNative := mload(add(_adapterParams, 66))
                dstNativeAddr := mload(add(_adapterParams, 86))
            }
        }

        bytes memory bytesSourceUserApplicationAddr = addrToPackedBytes(address(msg.sender)); // cast this address to bytes

        inboundNonce[_chainId][abi.encodePacked(msg.sender)] = nonce;
        LZEndpointMock(lzEndpoint).receiveAndForward(destAddr, mockChainId, bytesSourceUserApplicationAddr, nonce, _payload);
    }

    function receiveAndForward(address _destAddr, uint16 _srcChainId, bytes memory _srcAddress, uint64 _nonce, bytes memory _payload) external {
        ILayerZeroReceiver(_destAddr).lzReceive(_srcChainId, _srcAddress, _nonce, _payload); // invoke lzReceive
    }

    // @notice gets a quote in source native gas, for the amount that send() requires to pay for message delivery
    // @param _dstChainId - the destination chain identifier
    // @param _userApplication - the user app address on this EVM chain
    // @param _payload - the custom message to send over LayerZero
    // @param _payInZRO - if false, user app pays the protocol fee in native token
    // @param _adapterParam - parameters for the adapter service, e.g. send some dust native token to dstChain
    function estimateFees(uint16, address, bytes memory, bool, bytes memory) external view override returns (uint _nativeFee, uint _zroFee) {
        _nativeFee = nativeFee;
        _zroFee = zroFee;
    }

    // give 20 bytes, return the decoded address
    function packedBytesToAddr(bytes calldata _b) public pure returns (address) {
        address addr;
        assembly {
            let ptr := mload(0x40)
            calldatacopy(ptr, sub(_b.offset, 2), add(_b.length, 2))
            addr := mload(sub(ptr, 10))
        }
        return addr;
    }

    // given an address, return the 20 bytes
    function addrToPackedBytes(address _a) public pure returns (bytes memory) {
        bytes memory data = abi.encodePacked(_a);
        return data;
    }

    function setConfig(
        uint16, /*_version*/
        uint16, /*_chainId*/
        uint, /*_configType*/
        bytes memory /*_config*/
    ) external override {}

    function getConfig(
        uint16, /*_version*/
        uint16, /*_chainId*/
        address, /*_ua*/
        uint /*_configType*/
    ) external pure override returns (bytes memory) {
        return "";
    }

    function receivePayload(uint16 _srcChainId, bytes calldata _srcAddress, address _dstAddress, uint64 _nonce, uint _gasLimit, bytes calldata _payload) external override {}

    function setSendVersion(
        uint16 /*version*/
    ) external override {}

    function setReceiveVersion(
        uint16 /*version*/
    ) external override {}

    function getSendVersion(
        address /*_userApplication*/
    ) external pure override returns (uint16) {
        return 1;
    }

    function getReceiveVersion(
        address /*_userApplication*/
    ) external pure override returns (uint16) {
        return 1;
    }

    function getInboundNonce(uint16 _chainID, bytes calldata _srcAddress) external view override returns (uint64) {
        return inboundNonce[_chainID][_srcAddress];
    }

    function getOutboundNonce(uint16 _chainID, address _srcAddress) external view override returns (uint64) {
        return outboundNonce[_chainID][_srcAddress];
    }

    function forceResumeReceive(uint16 _srcChainId, bytes calldata _srcAddress) external override {
        // This mock does not implement the forceResumeReceive
    }

    function retryPayload(uint16 _srcChainId, bytes calldata _srcAddress, bytes calldata _payload) external pure override {}

    function hasStoredPayload(uint16, bytes memory) external pure override returns (bool) {
        return true;
    }

    function isSendingPayload() external pure override returns (bool) {
        return false;
    }

    function isReceivingPayload() external pure override returns (bool) {
        return false;
    }

    function getSendLibraryAddress(address) external view override returns (address) {
        return address(this);
    }

    function getReceiveLibraryAddress(address) external view override returns (address) {
        return address(this);
    }
}
