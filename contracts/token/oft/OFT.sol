// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./OFTCore.sol";
import "./IOFT.sol";

// override decimal() function is needed
contract OFT is OFTCore, ERC20, IOFT {
    constructor(
        string memory _name,
        string memory _symbol,
        address _lzEndpoint
    ) ERC20(_name, _symbol) OFTCore(_lzEndpoint) {}

    function _debitFrom(
        address _from,
        uint16,
        bytes memory,
        uint _amount
    ) internal virtual override {
        address spender = _msgSender();
        if (_from != spender) _spendAllowance(_from, spender, _amount);
        _burn(_from, _amount);
    }

    function _creditTo(
        uint16,
        address _toAddress,
        uint _amount
    ) internal virtual override {
        _mint(_toAddress, _amount);
    }
}
