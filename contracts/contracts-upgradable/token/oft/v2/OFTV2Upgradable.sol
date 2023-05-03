// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/introspection/IERC165Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "./BaseOFTV2Upgradable.sol";

contract OFTV2Upgradable is Initializable, BaseOFTV2Upgradable, ERC20Upgradeable {
    uint internal ld2sdRate;

    function __OFTV2Upgradable_init(string memory _name, string memory _symbol, uint8 _sharedDecimals, address _lzEndpoint) internal onlyInitializing {
        __ERC20_init_unchained(_name, _symbol);
        __BaseOFTV2Upgradable_init(_sharedDecimals, _lzEndpoint);
        uint8 _decimals = decimals();
        require(_sharedDecimals <= _decimals, "OFT: sharedDecimals must be <= decimals");
        ld2sdRate = 10 ** (_decimals - _sharedDecimals);
    }

    /************************************************************************
     * public functions
     ************************************************************************/
    function circulatingSupply() public view override returns (uint) {
        return totalSupply();
    }

    function token() public view override returns (address) {
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
}
