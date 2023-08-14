// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

abstract contract FeeUpgradeable is OwnableUpgradeable {
    uint public constant BP_DENOMINATOR = 10000;

    mapping(uint16 => FeeConfig) public chainIdToFeeBps;
    uint16 public defaultFeeBp;
    address public feeOwner; // defaults to owner

    struct FeeConfig {
        uint16 feeBP;
        bool enabled;
    }

    event SetFeeBp(uint16 dstchainId, bool enabled, uint16 feeBp);
    event SetDefaultFeeBp(uint16 feeBp);
    event SetFeeOwner(address feeOwner);

    function __FeeUpgradeable_init() internal onlyInitializing {
        __Ownable_init_unchained();
    }

    function __FeeUpgradeable_init_unchained(uint8 _sharedDecimals) internal onlyInitializing {}


    function setDefaultFeeBp(uint16 _feeBp) public virtual onlyOwner {
        require(_feeBp <= BP_DENOMINATOR, "Fee: fee bp must be <= BP_DENOMINATOR");
        defaultFeeBp = _feeBp;
        emit SetDefaultFeeBp(defaultFeeBp);
    }

    function setFeeBp(uint16 _dstChainId, bool _enabled, uint16 _feeBp) public virtual onlyOwner {
        require(_feeBp <= BP_DENOMINATOR, "Fee: fee bp must be <= BP_DENOMINATOR");
        chainIdToFeeBps[_dstChainId] = FeeConfig(_feeBp, _enabled);
        emit SetFeeBp(_dstChainId, _enabled, _feeBp);
    }

    function setFeeOwner(address _feeOwner) public virtual onlyOwner {
        require(_feeOwner != address(0x0), "Fee: feeOwner cannot be 0x");
        feeOwner = _feeOwner;
        emit SetFeeOwner(_feeOwner);
    }

    function quoteOFTFee(uint16 _dstChainId, uint _amount) public virtual view returns (uint fee) {
        FeeConfig memory config = chainIdToFeeBps[_dstChainId];
        if (config.enabled) {
            fee = _amount * config.feeBP / BP_DENOMINATOR;
        } else if (defaultFeeBp > 0) {
            fee = _amount * defaultFeeBp / BP_DENOMINATOR;
        } else {
            fee = 0;
        }
    }

    function _payOFTFee(address _from, uint16 _dstChainId, uint _amount) internal virtual returns (uint amount, uint fee) {
        fee = quoteOFTFee(_dstChainId, _amount);
        amount = _amount - fee;
        if (fee > 0) {
            _transferFrom(_from, feeOwner, fee);
        }
    }

    function _transferFrom(address _from, address _to, uint _amount) internal virtual returns (uint);

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint[45] private __gap;
}
