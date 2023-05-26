// SPDX-License-Identifier: BUSL-1.1

pragma solidity >=0.7.0;

interface IPreCrimeBase {
    struct Packet {
        uint16 srcChainId;
        bytes32 srcAddress; // source UA address
        uint64 nonce;
        bytes payload;
    }

    /**
     * @notice get precrime config
     * @param _packets remote packets
     * @return configuration abi-encoded configuration of remote chains and precrime addresses based on the provided packets. 
     * If no packets are passed, returns the configuration of all remote chains and precrime addresses.
     */
    function getConfig(Packet[] calldata _packets) external view returns (bytes memory);

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
    ) external view returns (uint16 code, bytes memory reason);

    /**
     * @notice protocol version
     */
    function version() external view returns (uint16);
}

interface IPreCrimeView is IPreCrimeBase {
    /**
     * @notice simulates cross-chain packets delivery and returns a simulation result for precrime() function
     * @param _packets cross-chain packets grouped by srcChainId, srcAddress, and sorted by nonce
     * @return code simulation result code; see the error code definition in PreCrimeBase
     * @return data simulation result for precrime() function
     */
    function simulate(Packet[] calldata _packets) external view returns (uint16 code, bytes memory data);
}
