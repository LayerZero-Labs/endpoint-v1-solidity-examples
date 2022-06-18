// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/introspection/IERC165Upgradeable.sol";
import "./OFTCore20Upgradeable.sol";
import "./IOFT20Upgradeable.sol";

// override decimal() function is needed
contract OFT20Upgradeable is Initializable, OFTCore20Upgradeable, ERC20Upgradeable, IOFT20Upgradeable {

    function __OFT20Upgradeable_init(string memory _name, string memory _symbol, address _lzEndpoint) public onlyInitializing {
        __OFT20Upgradeable_init_unchained(_name, _symbol, _lzEndpoint);
    }

    function __OFT20Upgradeable_init_unchained(string memory _name, string memory _symbol, address _lzEndpoint) public onlyInitializing {
        __ERC20_init_unchained(_name, _symbol);
        __LzAppUpgradeable_init_unchained(_lzEndpoint);
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(OFTCore20Upgradeable, IERC165Upgradeable) returns (bool) {
        return interfaceId == type(IOFT20Upgradeable).interfaceId || interfaceId == type(IERC20Upgradeable).interfaceId || super.supportsInterface(interfaceId);
    }

    function circulatingSupply() public view virtual override returns (uint) {
        return totalSupply();
    }

    function _debitFrom(address _from, uint16, bytes memory, uint _amount) internal virtual override {
        address spender = _msgSender();
        if (_from != spender) _spendAllowance(_from, spender, _amount);
        _burn(_from, _amount);
    }

    function _creditTo(uint16, address _toAddress, uint _amount) internal virtual override {
        _mint(_toAddress, _amount);
    }
}
