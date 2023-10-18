// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma abicoder v2;

import "../lzApp/NonblockingLzApp.sol";

/// @title OmniCounter - Cross chain message example for LayerZero
/// @notice This contract sends a cross-chain message from a source chain to a destination chain to increment a counter.
contract OmniCounter is NonblockingLzApp {
    
    /// @notice Constant payload used in cross-chain messages for this contract
    bytes public constant PAYLOAD = "\x01\x02\x03\x04";

    /// @notice Counter variable that gets incremented on receiving a message
    uint public counter;

    /// @dev Initializes the parent contract with the provided LayerZero endpoint address.
    /// @param _lzEndpoint Address of the LayerZero endpoint
    constructor(address _lzEndpoint) NonblockingLzApp(_lzEndpoint) {}

    /// @dev Internal function that increments the counter when a LayerZero message is received.
    function _nonblockingLzReceive(
        uint16,
        bytes memory,
        uint64,
        bytes memory
    ) internal override {
        counter += 1;
    }

    /// @notice Estimates the fee required to send a cross-chain message with the given parameters.
    /// @param _dstChainId The ID of the destination chain endpoint contract
    /// @param _useZro Whether to use ZRO for fee payment
    /// @param _adapterParams Adapter parameters for the cross-chain message
    /// @return nativeFee Fee in native gas
    /// @return zroFee Fee in ZRO token
    function estimateFee(
        uint16 _dstChainId,
        bool _useZro,
        bytes calldata _adapterParams
    ) public view returns (uint nativeFee, uint zroFee) {
        return lzEndpoint.estimateFees(_dstChainId, address(this), PAYLOAD, _useZro, _adapterParams);
    }

    /// @notice Sends a cross-chain message to increment the counter on the destination chain.
    /// @param _dstChainId The ID of the destination chain endpoint contract
    function incrementCounter(uint16 _dstChainId) public payable {
        _lzSend(_dstChainId, PAYLOAD, payable(msg.sender), address(0x0), bytes(""), msg.value);
    }

    /// @notice Sets the oracle for a specific chain.
    /// @dev Can only be called by the owner of the contract.
    /// @param dstChainId The ID of the destination chain endpoint contract
    /// @param oracle Address of the oracle
    function setOracle(uint16 dstChainId, address oracle) external onlyOwner {
        uint TYPE_ORACLE = 6;
        // set the Oracle
        lzEndpoint.setConfig(lzEndpoint.getSendVersion(address(this)), dstChainId, TYPE_ORACLE, abi.encode(oracle));
    }

    /// @notice Retrieves the Oracle address for a specific chain.
    /// @param remoteChainId The ID of the remote chain endpoint contract
    /// @return _oracle Address of the oracle
    function getOracle(uint16 remoteChainId) external view returns (address _oracle) {
        bytes memory bytesOracle = lzEndpoint.getConfig(lzEndpoint.getSendVersion(address(this)), remoteChainId, address(this), 6);
        assembly {
            _oracle := mload(add(bytesOracle, 32))
        }
    }
}
