// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "hardhat-deploy/solc_0.8/proxy/Proxied.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "./BaseOFTV2Upgradeable.sol";

contract OFTV2Upgradeable is BaseOFTV2Upgradeable, ERC20Upgradeable, Proxied {

    uint internal ld2sdRate;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(string memory _name, string memory _symbol, uint8 _sharedDecimals, address _lzEndpoint) public virtual initializer {
        __OFTV2Upgradeable_init(_name, _symbol, _sharedDecimals, _lzEndpoint);
    }

    function __OFTV2Upgradeable_init(string memory _name, string memory _symbol, uint8 _sharedDecimals, address _lzEndpoint) internal onlyInitializing {
        __BaseOFTV2Upgradeable_init(_sharedDecimals, _lzEndpoint);
        __ERC20_init(_name, _symbol);
        __OFTV2Upgradeable_init_unchained(_sharedDecimals);
    }

    function __OFTV2Upgradeable_init_unchained(uint8 _sharedDecimals) internal onlyInitializing {
        uint8 decimals = decimals();
        require(_sharedDecimals <= decimals, "OFT: sharedDecimals must be <= decimals");
        ld2sdRate = 10 ** (decimals - _sharedDecimals);
    }

    /************************************************************************
    * public functions
    ************************************************************************/
    function circulatingSupply() public view virtual override returns (uint) {
        return totalSupply();
    }

    function token() public view virtual override returns (address) {
        return address(this);
    }

    /************************************************************************
    * internal functions
    ************************************************************************/
    function _debitFrom(address _from, uint16, bytes32, uint _amount) internal virtual override returns (uint) {
        address spender = _msgSender();
        if (_from != spender) _spendAllowance(_from, spender, _amount);
        _burn(_from, _amount);
        return _amount;
    }

    function _creditTo(uint16, address _toAddress, uint _amount) internal virtual override returns (uint) {
        _mint(_toAddress, _amount);
        return _amount;
    }

    function _transferFrom(address _from, address _to, uint _amount) internal virtual override returns (uint) {
        address spender = _msgSender();
        // if transfer from this contract, no need to check allowance
        if (_from != address(this) && _from != spender) _spendAllowance(_from, spender, _amount);
        _transfer(_from, _to, _amount);
        return _amount;
    }

    function _ld2sdRate() internal view virtual override returns (uint) {
        return ld2sdRate;
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint[49] private __gap;
}
