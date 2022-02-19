// SPDX-License-Identifier: BUSL-1.1

pragma solidity >=0.5.0;

interface ILayerZeroUserApplicationConfig {
    // @notice generic config getter/setter for user app
    function setConfig(uint16 _version, uint _configType, bytes calldata _config) external;

    function getConfig(uint16 _version, uint16 _chainId, address _userApplication, uint _configType) external view returns (bytes memory);

    // @notice LayerZero versions. Send/Receive can be different versions during migration
    function setSendVersion(uint16 version) external;

    function setReceiveVersion(uint16 version) external;

    function getSendVersion() external view returns (uint16);

    function getReceiveVersion() external view returns (uint16);

    // @notice Only in extreme cases where the UA needs to resume the message flow
    function forceResumeReceive(uint16 _srcChainId, bytes calldata _srcAddress) external;
}
