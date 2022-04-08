pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/ILayerZeroReceiver.sol";
import "../interfaces/ILayerZeroUserApplicationConfigV2.sol";
import "../interfaces/ILayerZeroEndpoint.sol";

/*
 * a generic LzReceiver implementation
 */
abstract contract LzReceiver is Ownable, ILayerZeroReceiver, ILayerZeroUserApplicationConfigV2 {
    ILayerZeroEndpoint public endpoint;

    mapping(uint16 => bytes) public trustedSourceLookup;

    function lzReceive(
        uint16 _srcChainId,
        bytes memory _srcAddress,
        uint64 _nonce,
        bytes memory _payload
    ) external override {
        // lzReceive must be called by the endpoint for security
        require(_msgSender() == address(endpoint));
        // if will still block the message pathway from (srcChainId, srcAddress). should not receive message from untrusted remote.
        require(
            _srcAddress.length == trustedSourceLookup[_srcChainId].length &&
                keccak256(_srcAddress) == keccak256(trustedSourceLookup[_srcChainId]),
            "LzReceiver: invalid source sending contract"
        );

        _LzReceive(_srcChainId, _srcAddress, _nonce, _payload);
    }

    // abstract function
    function _LzReceive(
        uint16 _srcChainId,
        bytes memory _srcAddress,
        uint64 _nonce,
        bytes memory _payload
    ) internal virtual;

    function _lzSend(
        uint16 _dstChainId,
        bytes memory _payload,
        address payable _refundAddress,
        address _zroPaymentAddress,
        bytes memory _txParam
    ) internal {
        endpoint.send{value: msg.value}(_dstChainId, trustedSourceLookup[_dstChainId], _payload, _refundAddress, _zroPaymentAddress, _txParam);
    }

    //---------------------------DAO CALL----------------------------------------
    // generic config for user Application
    function setConfig(
        uint16 _version,
        uint16 _chainId,
        uint256 _configType,
        bytes calldata _config
    ) external override onlyOwner {
        endpoint.setConfig(_version, _chainId, _configType, _config);
    }


    function getConfig(
        uint16, /*_dstChainId*/
        uint16 _chainId,
        address,
        uint256 _configType
    ) external view returns (bytes memory) {
        return endpoint.getConfig(endpoint.getSendVersion(address(this)), _chainId, address(this), _configType);
    }

    function getSendVersion() external view returns (uint16) {
        return endpoint.getSendVersion(address(this));
    }

    function getReceiveVersion() external view returns (uint16) {
        return endpoint.getReceiveVersion(address(this));
    }

//    // set the Oracle to be used by this UA for LayerZero messages
//    function setOracle(uint16 dstChainId, address oracle) external {
//        uint256 TYPE_ORACLE = 6; // from UltraLightNode
//        // set the Oracle
//        endpoint.setConfig(endpoint.getSendVersion(address(this)), dstChainId, TYPE_ORACLE, abi.encode(oracle));
//    }
//
//    // set the inbound block confirmations
//    function setInboundConfirmations(uint16 sourceChainId, uint16 confirmations) external {
//        endpoint.setConfig(
//            endpoint.getSendVersion(address(this)),
//            sourceChainId,
//            2, // CONFIG_TYPE_INBOUND_BLOCK_CONFIRMATIONS
//            abi.encode(confirmations)
//        );
//    }
//
//    // set outbound block confirmations
//    function setOutboundConfirmations(uint16 sourceChainId, uint16 confirmations) external {
//        endpoint.setConfig(
//            endpoint.getSendVersion(address(this)),
//            sourceChainId,
//            5, // CONFIG_TYPE_OUTBOUND_BLOCK_CONFIRMATIONS
//            abi.encode(confirmations)
//        );
//    }

    function setSendVersion(uint16 _version) external override onlyOwner {
        endpoint.setSendVersion(_version);
    }

    function setReceiveVersion(uint16 _version) external override onlyOwner {
        endpoint.setReceiveVersion(_version);
    }

    function forceResumeReceive(uint16 _srcChainId, bytes calldata _srcAddress) external override onlyOwner {
        endpoint.forceResumeReceive(_srcChainId, _srcAddress);
    }

    // allow owner to set it multiple times.
    function setTrustedSource(uint16 _srcChainId, bytes calldata _srcAddress) external override onlyOwner {
        trustedSourceLookup[_srcChainId] = _srcAddress;
        emit SetTrustedSource(_srcChainId, _srcAddress);
    }

    function isTrustedSource(uint16 _srcChainId, bytes calldata _srcAddress) external view override returns (bool) {
        bytes memory trustedSource = trustedSourceLookup[_srcChainId];
        return keccak256(trustedSource) == keccak256(_srcAddress);
    }
}
