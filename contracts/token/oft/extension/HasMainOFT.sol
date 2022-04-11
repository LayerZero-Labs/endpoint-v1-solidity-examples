pragma solidity ^0.8.0;
import "../OFT.sol";

contract HasMainOFT is OFT{
    bool public isMain;

    constructor(
        string memory _name,
        string memory _symbol,
        address _lzEndpoint,
        uint256 _initialSupply,
        uint16 _mainChainId
    ) OFT(_name, _symbol, _lzEndpoint, 0){
        // only mint the total supply on the main chain
        if (ILayerZeroEndpoint(_lzEndpoint).getChainId() == _mainChainId) {
            _mint(_msgSender(), _initialSupply);
            isMain = true;
        }
    }

    function _debitFrom(
        address _from,
        uint16 _dstChainId,
        bytes memory _toAddress,
        uint256 _amount
    ) internal override {
        if (isMain) {
            // lock by transferring to this contract if leaving the main chain,
            _transfer(_msgSender(), address(this), _amount);
        } else {
            // burn if leaving non-main chain
            _burn(_msgSender(), _amount);
        }
    }

    function _creditTo(
        uint16 _srcChainId,
        address _toAddress,
        uint256 _amount
    ) internal override {
        // on the main chain unlock via transfer, otherwise _mint
        if (isMain) {
            _transfer(address(this), _toAddress, _amount);
        } else {
            _mint(_toAddress, _amount);
        }
    }
}
