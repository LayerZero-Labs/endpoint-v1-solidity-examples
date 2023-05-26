// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

import "./IPreCrime.sol";
import "./PreCrimeBase.sol";

abstract contract PreCrimeView is PreCrimeBase, IPreCrimeView {
    /**
     * @dev 10000 - 20000 is for view mode, 20000 - 30000 is for precrime inherit mode
     */
    uint16 public constant PRECRIME_VERSION = 10001;

    constructor(uint16 _localChainId) PreCrimeBase(_localChainId) {}

    /**
     * @notice simulates cross-chain packets delivery and returns a simulation result for precrime() function
     * @param _packets cross-chain packets grouped by srcChainId, srcAddress, and sorted by nonce
     * @return code simulation result code; see the error code definition in PreCrimeBase
     * @return data simulation result for precrime() function
     */
    function simulate(Packet[] calldata _packets) external view override returns (uint16 code, bytes memory data) {
        // params check
        (code, data) = _checkPacketsMaxSizeAndNonceOrder(_packets);
        if (code != CODE_SUCCESS) {
            return (code, data);
        }

        (code, data) = _simulate(_packets);
        if (code == CODE_SUCCESS) {
            data = abi.encode(localChainId, data); // add localChainId to the header
        }
    }

    /**
     * @dev simulation logic must implemented in child contracts
     * @param _packets cross-chain packets grouped by srcChainId, srcAddress, and sorted by nonce
     * @return code simulation result code; see the error code definition in PreCrimeBase
     * @return data simulation result for precrime() function
     */
    function _simulate(Packet[] calldata _packets) internal view virtual returns (uint16 code, bytes memory data);

    function version() external pure override returns (uint16) {
        return PRECRIME_VERSION;
    }
}
