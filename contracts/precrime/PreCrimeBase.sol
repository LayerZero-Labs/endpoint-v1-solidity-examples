// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

import "./IPreCrime.sol";

abstract contract PreCrimeBase is IPreCrimeBase {
    uint16 public constant CONFIG_VERSION = 1;

    //---------------- error code ----------------------
    // --- UA scope code ---
    uint16 public constant CODE_SUCCESS = 0; // success
    uint16 public constant CODE_PRECRIME_FAILURE = 1; // !!! crime found

    // --- protocol scope error code ---
    // simualte
    uint16 public constant CODE_PACKETS_OVERSIZE = 2; // the number of packets is greater than max size
    uint16 public constant CODE_PACKETS_UNSORTED = 3; // packets are unsorted
    // precrime
    uint16 public constant CODE_MISS_SIMULATE_RESULT = 4; // miss simulation result

    uint16 public localChainId;

    constructor(uint16 _localChainId) {
        localChainId = _localChainId;
    }

    /**
     * @notice get precrime config
     * @param _packets remote packets
     * @return configuration abi-encoded configuration of remote chains and precrime addresses based on the provided packets. 
     * If no packets are passed, returns the configuration of all remote chains and precrime addresses.
     */
    function getConfig(Packet[] calldata _packets) external view virtual override returns (bytes memory) {
        (uint16[] memory remoteChains, bytes32[] memory remoteAddresses) = _remotePrecrimeAddress(_packets);
        return
            abi.encodePacked(
                CONFIG_VERSION,
                //---- max number of packets for simulate batch ---
                _maxBatchSize(),
                //------------- remote precrimes -------------
                remoteChains.length,
                remoteChains,
                remoteAddresses
            );
    }

    /**
     * @notice runs precrime using simulation results from different chains
     * @param _packets remote packets
     * @param _simulation simulation results from different chains
     * @return code precrime result code
     * @return reason error reason
     */
    function precrime(
        Packet[] calldata _packets,
        bytes[] calldata _simulation
    ) external view override returns (uint16 code, bytes memory reason) {
        bytes[] memory originSimulateResult = new bytes[](_simulation.length);
        uint16[] memory chainIds = new uint16[](_simulation.length);
        for (uint256 i = 0; i < _simulation.length; i++) {
            (uint16 chainId, bytes memory simulateResult) = abi.decode(_simulation[i], (uint16, bytes));
            chainIds[i] = chainId;
            originSimulateResult[i] = simulateResult;
        }

        (code, reason) = _checkResultsCompleteness(_packets, chainIds);
        if (code != CODE_SUCCESS) {
            return (code, reason);
        }

        (code, reason) = _precrime(originSimulateResult);
    }

    function _checkPacketsMaxSizeAndNonceOrder(
        Packet[] calldata _packets
    ) internal view returns (uint16 code, bytes memory reason) {
        uint64 maxSize = _maxBatchSize();
        if (_packets.length > maxSize) {
            return (CODE_PACKETS_OVERSIZE, abi.encodePacked("packets size exceed limited"));
        }

        // check packets nonce, sequence order
        // packets should be grouped by srcChainId and srcAddress, sorted by nonce ascending
        if (_packets.length > 0) {
            uint16 srcChainId;
            bytes32 srcAddress;
            uint64 nonce;
            for (uint256 i = 0; i < _packets.length; i++) {
                Packet memory packet = _packets[i];
                // start from a new chain packet or a new source UA
                if (packet.srcChainId != srcChainId || packet.srcAddress != srcAddress) {
                    srcChainId = packet.srcChainId;
                    srcAddress = packet.srcAddress;
                    nonce = packet.nonce;
                    uint64 nextInboundNonce = _getInboundNonce(packet) + 1;
                    // the first packet's nonce must equal to dst InboundNonce+1
                    if (nonce != nextInboundNonce) {
                        return (CODE_PACKETS_UNSORTED, abi.encodePacked("skipped inboundNonce forbidden"));
                    }
                } else {
                    // the following packet's nonce add 1 in order
                    if (packet.nonce != ++nonce) {
                        return (CODE_PACKETS_UNSORTED, abi.encodePacked("unsorted packets"));
                    }
                }
            }
        }
        return (CODE_SUCCESS, "");
    }

    function _checkResultsCompleteness(
        Packet[] calldata _packets,
        uint16[] memory _resultChainIds
    ) internal view returns (uint16 code, bytes memory reason) {
        // check if all remote result included
        if (_packets.length > 0) {
            (uint16[] memory remoteChains, ) = _remotePrecrimeAddress(_packets);
            for (uint256 i = 0; i < remoteChains.length; i++) {
                bool resultChainIdChecked;
                for (uint256 j = 0; j < _resultChainIds.length; j++) {
                    if (_resultChainIds[j] == remoteChains[i]) {
                        resultChainIdChecked = true;
                        break;
                    }
                }
                if (!resultChainIdChecked) {
                    return (CODE_MISS_SIMULATE_RESULT, "missing remote simulation result");
                }
            }
        }
        // check if local result included
        bool localChainIdResultChecked;
        for (uint256 j = 0; j < _resultChainIds.length; j++) {
            if (_resultChainIds[j] == localChainId) {
                localChainIdResultChecked = true;
                break;
            }
        }
        if (!localChainIdResultChecked) {
            return (CODE_MISS_SIMULATE_RESULT, "missing local simulation result");
        }

        return (CODE_SUCCESS, "");
    }

    /**
     * @dev precrime logic must be overridden by child contract
     * @param _simulation all simulation results from difference chains
     * @return code precrime result code
     * @return reason error reason
     */
    function _precrime(bytes[] memory _simulation) internal view virtual returns (uint16 code, bytes memory reason);

    /**
     * @dev returns trusted remote chains and precrime addresses by packets
     * @param _packets packets
     * @return remoteChainIds remote chain ids
     * @return remoteAddresses remote precrime addresses
     */
    function _remotePrecrimeAddress(
        Packet[] calldata _packets
    ) internal view virtual returns (uint16[] memory, bytes32[] memory);

    /**
     * @dev max batch size for simulate
     */
    function _maxBatchSize() internal view virtual returns (uint64);

    /**
     * get srcChain & srcAddress InboundNonce by packet
     */
    function _getInboundNonce(Packet memory packet) internal view virtual returns (uint64 nonce);
}
