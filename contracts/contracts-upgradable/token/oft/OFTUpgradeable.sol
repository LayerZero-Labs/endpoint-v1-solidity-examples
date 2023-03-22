// SPDX-License-Identifier: MIT

pragma solidity ^0.8.2;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/introspection/IERC165Upgradeable.sol";
import "./IOFTUpgradeable.sol";
import "./OFTCoreUpgradeable.sol";

// override decimal() function is needed
contract OFTUpgradeable is Initializable, OFTCoreUpgradeable, ERC20Upgradeable, IOFTUpgradeable {
    function __OFTUpgradeable_init(string memory _name, string memory _symbol, address _lzEndpoint) internal onlyInitializing {
        __ERC20_init_unchained(_name, _symbol);
        __Ownable_init_unchained();
        __LzAppUpgradeable_init_unchained(_lzEndpoint);
    }

    function __OFTUpgradeable_init_unchained(string memory _name, string memory _symbol, address _lzEndpoint) internal onlyInitializing {}

    function supportsInterface(bytes4 interfaceId) public view virtual override(OFTCoreUpgradeable, IERC165Upgradeable) returns (bool) {
        return interfaceId == type(IOFTUpgradeable).interfaceId || interfaceId == type(IERC20Upgradeable).interfaceId || super.supportsInterface(interfaceId);
    }

    function token() public view virtual override returns (address) {
        return address(this);
    }

    function circulatingSupply() public view virtual override returns (uint) {
        return totalSupply();
    }

    function _debitFrom(address _from, uint16, bytes memory, uint _amount) internal virtual override returns(uint) {
        address spender = _msgSender();
        if (_from != spender) _spendAllowance(_from, spender, _amount);
        _burn(_from, _amount);
        return _amount;
    }

    function _creditTo(uint16, address _toAddress, uint _amount) internal virtual override returns(uint) {
        _mint(_toAddress, _amount);
        return _amount;
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint[50] private __gap;
}
