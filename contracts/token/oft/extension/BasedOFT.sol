// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "../OFT.sol";

contract BasedOFT is OFT {
    constructor(string memory _name, string memory _symbol, address _lzEndpoint, uint _globalSupply) OFT(_name, _symbol, _lzEndpoint, _globalSupply) {}

    function _debitFrom(address, uint16, bytes memory, uint _amount) internal override {
        _transfer(_msgSender(), address(this), _amount);
    }

    function _creditTo(uint16, address _toAddress, uint _amount) internal override {
        _transfer(address(this), _toAddress, _amount);
    }

    function getType() public view virtual override returns(uint) {
        return 1;
    }
}
