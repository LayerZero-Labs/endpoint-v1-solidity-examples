// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../OFTCoreV2Upgradeable.sol";
import "./IOFTWithFeeUpgradeable.sol";
import "./FeeUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";

abstract contract BaseOFTWithFeeUpgradeable is OFTCoreV2Upgradeable, FeeUpgradeable, ERC165Upgradeable, IOFTWithFeeUpgradeable {

    function __BaseOFTWithFeeUpgradeable_init(uint8 _sharedDecimals, address _lzEndpoint) internal onlyInitializing {
        __OFTCoreV2Upgradeable_init(_sharedDecimals, _lzEndpoint);
        __FeeUpgradeable_init();
        __ERC165_init();
    }

    function __BaseOFTWithFeeUpgradeable_init_unchained() internal onlyInitializing {}

    /************************************************************************
    * public functions
    ************************************************************************/
    function sendFrom(address _from, uint16 _dstChainId, bytes32 _toAddress, uint _amount, uint _minAmount, LzCallParams calldata _callParams) public payable virtual override {
        (_amount,) = _payOFTFee(_from, _dstChainId, _amount);
        _amount = _send(_from, _dstChainId, _toAddress, _amount, _callParams.refundAddress, _callParams.zroPaymentAddress, _callParams.adapterParams);
        require(_amount >= _minAmount, "BaseOFTWithFee: amount is less than minAmount");
    }

    function sendAndCall(address _from, uint16 _dstChainId, bytes32 _toAddress, uint _amount, uint _minAmount, bytes calldata _payload, uint64 _dstGasForCall, LzCallParams calldata _callParams) public payable virtual override {
        (_amount,) = _payOFTFee(_from, _dstChainId, _amount);
        _amount = _sendAndCall(_from, _dstChainId, _toAddress, _amount, _payload, _dstGasForCall, _callParams.refundAddress, _callParams.zroPaymentAddress, _callParams.adapterParams);
        require(_amount >= _minAmount, "BaseOFTWithFee: amount is less than minAmount");
    }

    /************************************************************************
    * public view functions
    ************************************************************************/
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165Upgradeable, IERC165Upgradeable) returns (bool) {
        return interfaceId == type(IOFTWithFeeUpgradeable).interfaceId || super.supportsInterface(interfaceId);
    }

    function estimateSendFee(uint16 _dstChainId, bytes32 _toAddress, uint _amount, bool _useZro, bytes calldata _adapterParams) public view virtual override returns (uint nativeFee, uint zroFee) {
        return _estimateSendFee(_dstChainId, _toAddress, _amount, _useZro, _adapterParams);
    }

    function estimateSendAndCallFee(uint16 _dstChainId, bytes32 _toAddress, uint _amount, bytes calldata _payload, uint64 _dstGasForCall, bool _useZro, bytes calldata _adapterParams) public view virtual override returns (uint nativeFee, uint zroFee) {
        return _estimateSendAndCallFee(_dstChainId, _toAddress, _amount, _payload, _dstGasForCall, _useZro, _adapterParams);
    }

    function circulatingSupply() public view virtual override returns (uint);

    function token() public view virtual override returns (address);

    function _transferFrom(address _from, address _to, uint _amount) internal virtual override (FeeUpgradeable, OFTCoreV2Upgradeable) returns (uint);

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint[50] private __gap;
}
