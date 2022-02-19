// SPDX-License-Identifier: BUSL-1.1

pragma solidity >=0.5.0;

import "./ILayerZeroUserApplicationConfig.sol";

// an interface for the two primary methods of a LayerZero endpoint:
//    - send()
//    - estimateFees()
interface ILayerZeroEndpoint is ILayerZeroUserApplicationConfig {
    // @notice send a LayerZero message to the specified address at a LayerZero endpoint.
    // @param _chainId - the destination chain identifier
    // @param _destination - the address on destination chain (in bytes). address length/format may vary by chains
    // @param _payload - a custom bytes payload to send to the destination contract
    // @param _refundAddress - if the source transaction is cheaper than the amount of value passed, refund the additional amount to this address
    // @param _zroPaymentAddress - the address of the ZRO token holder who would pay for the transaction
    // @param _adapterParams - parameters for custom functionality. ie: pay for a specified destination gasAmount, or receive airdropped native gas from the relayer on destination (oh yea!)
    function send(uint16 _chainId, bytes calldata _destination, bytes calldata _payload, address payable refundAddress, address _zroPaymentAddress, bytes calldata _adapterParams) external payable;

    // @notice get the inboundNonce of a receiver from a source chain which could be EVM or non-EVM chain
    // @param _srcChainID - the source chain identifier
    // @param _srcAddress - the source chain contract address
    function getInboundNonce(uint16 _srcChainID, bytes calldata _srcAddress) external view returns (uint64);

    // @notice get the outboundNonce from this source chain which, consequently, is always an EVM
    // @param _srcAddress - the source chain contract address
    function getOutboundNonce(uint16 _dstChainID, address _srcAddress) external view returns (uint64);

    // @notice gets a quote in source native gas, for the amount that send() requires to pay for message delivery
    // @param _dstChainId - the destination chain identifier
    // @param _userApplication - the user app address on this EVM chain
    // @param _payload - the custom message to send over LayerZero
    // @param _payInZRO - if false, user app pays the protocol fee in native token
    // @param _adapterParam - parameters for the adapter service, e.g. send some dust native token to dstChain
    function estimateFees(uint16 _dstChainId, address _userApplication, bytes calldata _payload, bool _payInZRO, bytes calldata _adapterParam) external view returns (uint nativeFee, uint zroFee);

    // @notice get this Endpoint's immutable source identifier
    function getEndpointId() external view returns (uint16);

    // @notice the interface to retry failed message on this Endpoint destination
    // @param _srcChainID - the source chain identifier
    // @param _srcAddress - the source chain contract address
    // @param _dstAddress - the destination chain contract address
    function retryPayload(uint16 _srcChainId, bytes calldata _srcAddress, address _dstAddress) external;

    // @notice query if any STORED payload (message blocking) at the endpoint.
    // @param _srcChainID - the source chain identifier
    // @param _srcAddress - the source chain contract address
    // @param _dstAddress - the destination chain contract address
    function hasStoredPayload(uint16 _srcChainId, bytes calldata _srcAddress, address _dstAddress) external view returns (bool);

    // @notice query if the _libraryAddress is valid for sending msgs.
    // @param _userApplication - the user app address on this EVM chain
    // @param _libraryAddress - the address of the layerzero library
    function isValidSendLibrary(address _userApplication, address _libraryAddress) external view returns (bool);

    // @notice query if the _libraryAddress is valid for receiving msgs.
    // @param _userApplication - the user app address on this EVM chain
    // @param _libraryAddress - the address of the layerzero library
    function isValidReceiveLibrary(address _userApplication, address _libraryAddress) external view returns (bool);
}

