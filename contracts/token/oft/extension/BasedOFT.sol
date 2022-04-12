// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "../OFT.sol";

contract BasedOFT is OFT {
    // true indicates this is the base chain for this oft
    bool public immutable isBase;

    constructor(
        string memory _name,
        string memory _symbol,
        address _lzEndpoint,
        uint256 _initialSupply,
        uint16 _baseChainId
    ) OFT(_name, _symbol, _lzEndpoint, 0) {
        // cant assign immutable variables inside an if statement
        isBase = ILayerZeroEndpoint(_lzEndpoint).getChainId() == _baseChainId;

        // only mint the total supply on the main chain
        if (ILayerZeroEndpoint(_lzEndpoint).getChainId() == _baseChainId) _mint(_msgSender(), _initialSupply);
    }

    function _debitFrom(
        address, // _from
        uint16, // _dstChainId
        bytes memory, // _toAddress
        uint256 _amount
    ) internal override {
        if (isBase) {
            // lock by transferring to this contract if leaving the main chain,
            _transfer(_msgSender(), address(this), _amount);
        } else {
            // burn if leaving non-main chain
            _burn(_msgSender(), _amount);
        }
    }

    function _creditTo(
        uint16, // _srcChainId
        address _toAddress,
        uint256 _amount
    ) internal override {
        // on the main chain unlock via transfer, otherwise _mint
        if (isBase) {
            _transfer(address(this), _toAddress, _amount);
        } else {
            _mint(_toAddress, _amount);
        }
    }
}
