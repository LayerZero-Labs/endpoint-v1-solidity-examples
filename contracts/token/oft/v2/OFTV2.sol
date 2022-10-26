// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "../IOFT.sol";
import "./OFTCoreV2.sol";

// override decimal() function is needed
contract OFTV2 is OFTCoreV2, ERC20, IOFT {
    constructor(string memory _name, string memory _symbol, uint8 _sharedDecimals, address _lzEndpoint) ERC20(_name, _symbol) OFTCoreV2(false, _sharedDecimals, _lzEndpoint) {}

    function supportsInterface(bytes4 interfaceId) public view virtual override(OFTCoreV2, IERC165) returns (bool) {
        return interfaceId == type(IOFT).interfaceId || interfaceId == type(IERC20).interfaceId || super.supportsInterface(interfaceId);
    }

    function circulatingSupply() public view virtual override returns (uint) {
        return totalSupply();
    }

    function _debitFrom(address _from, uint16, bytes memory, uint _amount) internal virtual override returns (uint) {
        address spender = _msgSender();
        if (_from != spender) _spendAllowance(_from, spender, _amount);
        _burn(_from, _amount);
        return _amount;
    }

    function _creditTo(uint16, address _toAddress, uint _amount) internal virtual override {
        _mint(_toAddress, _amount);
    }

    function _transferFrom(address _from, address _to, uint _amount) internal virtual override {
        address spender = _msgSender();
        if (_from != spender) _spendAllowance(_from, spender, _amount);
        _transfer(_from, _to, _amount);
    }

    function _decimals() internal view virtual override returns (uint8) {
        return decimals();
    }
}
