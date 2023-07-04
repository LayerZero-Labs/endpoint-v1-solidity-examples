// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { ERC20 } from "solmate/tokens/ERC20.sol";
import "./BaseOFTV2.sol";

contract OFTV2 is BaseOFTV2, ERC20 {
    // Custom errors save gas
    error InsufficientAllowance();
    error SharedDecimalsTooLarge();

    uint internal immutable ld2sdRate;

    constructor(
        string memory _name, 
        string memory _symbol, 
        uint8 decimals,
        uint8 _sharedDecimals,
        address authority,
        address _lzEndpoint
    ) 
        ERC20(_name, _symbol, decimals) 
        BaseOFTV2(_sharedDecimals, authority, _lzEndpoint) 
    {
        if (_sharedDecimals > decimals) revert SharedDecimalsTooLarge();
        ld2sdRate = 10 ** (decimals - _sharedDecimals);
    }

    /************************************************************************
    * public functions
    ************************************************************************/
    function circulatingSupply() public view virtual override returns (uint) {
        return totalSupply;
    }

    function token() public view virtual override returns (address) {
        return address(this);
    }

    /************************************************************************
    * internal functions
    ************************************************************************/
    function _debitFrom(address _from, uint16, bytes32, uint _amount) internal virtual override returns (uint) {
        address spender = msg.sender;
        if (_from != spender) _spendAllowance(_from, spender, _amount);
        _burn(_from, _amount);
        return _amount;
    }

    function _creditTo(uint16, address _toAddress, uint _amount) internal virtual override returns (uint) {
        _mint(_toAddress, _amount);
        return _amount;
    }

    function _transferFrom(address _from, address _to, uint _amount) internal virtual override returns (uint) {
        address spender = msg.sender;
        // if transfer from this contract, no need to check allowance
        if (_from != address(this) && _from != spender) _spendAllowance(_from, spender, _amount);
        _transfer(_from, _to, _amount);
        return _amount;
    }

    function _ld2sdRate() internal view virtual override returns (uint) {
        return ld2sdRate;
    }

    /**
     * OpenZeppelin ERC20 extensions
     */

    /**
     * @dev Updates `owner` s allowance for `spender` based on spent `amount`.
     *
     * Does not update the allowance amount in case of infinite allowance.
     * Revert if not enough allowance is available.
     */
    function _spendAllowance(address owner, address spender, uint256 amount) internal virtual {
        uint256 currentAllowance = allowance[owner][spender];
        if (currentAllowance != type(uint256).max) {
            if (currentAllowance < amount) {
                revert InsufficientAllowance();
            }
            unchecked {
                allowance[owner][spender] = currentAllowance - amount;
            }
        }
    }

    /**
     * @dev Moves `amount` of tokens from `from` to `to`.
     *
     * This internal function is equivalent to {transfer}, and can be used to
     * e.g. implement automatic token fees, slashing mechanisms, etc.
     */
    function _transfer(address from, address to, uint256 amount) internal {
        balanceOf[from] -= amount;
        unchecked {
            balanceOf[to] += amount;
        }
    }
}
