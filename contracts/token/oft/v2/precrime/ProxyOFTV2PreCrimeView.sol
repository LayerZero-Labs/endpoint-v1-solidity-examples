// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;
pragma abicoder v2;

import "@openzeppelin-3/contracts/access/Ownable.sol";
import "@layerzerolabs/lz-evm-sdk-v1-0.7/contracts/precrime/PreCrimeView.sol";
import "./IOFTV2View.sol";

/// @title A pre-crime contract for tokens with one ProxyOFTV2 and multiple OFTV2 contracts
/// @notice Ensures that the total supply on all chains will remain the same when tokens are transferred between chains
/// @dev This contract must only be used for tokens with fixed total supply
contract ProxyOFTV2PreCrimeView is PreCrimeView, Ownable {
    struct SimulationResult {
        uint chainTotalSupply;
        bool isProxy;
    }

    /// @notice a view for OFTV2 or ProxyOFTV2
    IOFTV2View public immutable oftView;
    uint16[] public remoteChainIds;
    bytes32[] public remotePrecrimeAddresses;
    uint64 public maxBatchSize;

    constructor(uint16 _localChainId, address _oftView, uint64 _maxSize) PreCrimeView(_localChainId) {
        oftView = IOFTV2View(_oftView);
        setMaxBatchSize(_maxSize);
    }

    function setRemotePrecrimeAddresses(uint16[] memory _remoteChainIds, bytes32[] memory _remotePrecrimeAddresses) public onlyOwner {
        require(_remoteChainIds.length == _remotePrecrimeAddresses.length, "ProxyOFTV2PreCrimeView: invalid size");
        remoteChainIds = _remoteChainIds;
        remotePrecrimeAddresses = _remotePrecrimeAddresses;
    }

    function setMaxBatchSize(uint64 _maxSize) public onlyOwner {
        maxBatchSize = _maxSize;
    }

    function _simulate(Packet[] calldata _packets) internal view override returns (uint16, bytes memory) {
        uint totalSupply = oftView.getCurrentState();

        for (uint i = 0; i < _packets.length; i++) {
            Packet memory packet = _packets[i];
            totalSupply = oftView.lzReceive(packet.srcChainId, packet.srcAddress, packet.payload, totalSupply);
        }

        return (CODE_SUCCESS, abi.encode(SimulationResult({chainTotalSupply: totalSupply, isProxy: oftView.isProxy()})));
    }

    function _precrime(bytes[] memory _simulation) internal pure override returns (uint16 code, bytes memory reason) {
        uint totalLocked = 0;
        uint totalMinted = 0;

        for (uint i = 0; i < _simulation.length; i++) {
            SimulationResult memory result = abi.decode(_simulation[i], (SimulationResult));
            if (result.isProxy) {
                if (totalLocked > 0) {
                    return (CODE_PRECRIME_FAILURE, "more than one proxy simulation");
                }
                totalLocked = result.chainTotalSupply;
            } else {
                totalMinted += result.chainTotalSupply;
            }
        }

        // It is possible to encounter a race condition when getting state of totalLocked. 
        // Other users could have sent more tokens out.
        if (totalLocked != totalMinted) {
            return (CODE_PRECRIME_FAILURE, "total minted != total locked");
        }

        return (CODE_SUCCESS, "");
    }

    /// @dev always returns all remote chain ids and precrime addresses
    function _remotePrecrimeAddress(Packet[] calldata) internal view override returns (uint16[] memory chainIds, bytes32[] memory precrimeAddresses) {
        return (remoteChainIds, remotePrecrimeAddresses);
    }

    function _getInboundNonce(Packet memory _packet) internal view override returns (uint64) {
        return oftView.getInboundNonce(_packet.srcChainId);
    }

    function _maxBatchSize() internal view virtual override returns (uint64) {
        return maxBatchSize;
    }
}
