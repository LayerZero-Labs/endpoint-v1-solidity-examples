// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IOFTV2View.sol";
import "../OFTCoreV2.sol";

contract OFTV2View is IOFTV2View {
    using BytesLib for bytes;

    OFTCoreV2 immutable oft;
    ILayerZeroEndpoint immutable endpoint;

    /// @notice Local decimals to shared decimals rate
    uint immutable ld2sdRate;

    constructor(address _oft) {
        oft = OFTCoreV2(_oft);
        endpoint = OFTCoreV2(_oft).lzEndpoint();

        (, bytes memory data) = ICommonOFT(_oft).token().staticcall(abi.encodeWithSignature("decimals()"));
        uint8 decimals = abi.decode(data, (uint8));
        uint8 sharedDecimals = OFTCoreV2(_oft).sharedDecimals();
        ld2sdRate = 10**(decimals - sharedDecimals);
    }

    function lzReceive(uint16 _srcChainId, bytes32 _scrAddress, bytes memory _payload, uint _totalSupply) external view virtual returns (uint) {
        require(_isPacketFromTrustedRemote(_srcChainId, _scrAddress), "OFTV2View: not trusted remote");
        uint amount = _decodePayload(_payload);
        return _totalSupply + amount;
    }

    function _decodePayload(bytes memory _payload) internal view returns (uint) {
        uint64 amountSD = _payload.toUint64(33);
        return amountSD * ld2sdRate;
    }

    function getInboundNonce(uint16 _srcChainId) external view virtual returns (uint64) {
        bytes memory path = oft.trustedRemoteLookup(_srcChainId);
        return endpoint.getInboundNonce(_srcChainId, path);
    }

    function isProxy() external view virtual returns (bool) {
        return false;
    }

    function getCurrentState() external view virtual returns (uint) {
        return IERC20(address(oft)).totalSupply();
    }

    function _isPacketFromTrustedRemote(uint16 _srcChainId, bytes32 _srcAddress) internal view returns (bool) {
        bytes memory path = oft.trustedRemoteLookup(_srcChainId);
        uint pathLength = path.length;
        
        // EVM - EVM path length 40 (address + address)
        // EVM - non-EVM path length 52 (bytes32 + address)
        require(pathLength == 40 || pathLength == 52, "OFTV2View: invalid path length");

        // path format: remote + local
        path = path.slice(0, pathLength - 20);

        uint remoteAddressLength = path.length;
        uint mask = (2**(remoteAddressLength * 8)) - 1;
        bytes32 remoteUaAddress;

        assembly {
            remoteUaAddress := and(mload(add(path, remoteAddressLength)), mask)
        }

        return remoteUaAddress == _srcAddress;
    }
}
