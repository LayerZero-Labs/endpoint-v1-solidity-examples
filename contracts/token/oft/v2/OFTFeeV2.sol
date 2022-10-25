// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "../IOFT.sol";
import "./OFTCoreV2.sol";

contract OFTFeeV2 is OFTCoreV2, ERC20, IOFT {
    uint public constant BP_DENOMINATOR = 10000;
    uint public universalBp; // overrides the dstChainIdBp
    mapping(uint16 => uint) public dstChainIdBp;
    address public feeOwner; // defaults to owner

    event SetDstChainIdBp(uint16 dstchainId, uint dstChainIdBp);
    event SetUniversalBp(uint universalBp);
    event SetFeeOwner(address feeOwner);

    constructor(string memory _name, string memory _symbol, address _lzEndpoint) ERC20(_name, _symbol) OFTCoreV2(false, _lzEndpoint) {
        feeOwner = owner();
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(OFTCoreV2, IERC165) returns (bool) {
        return interfaceId == type(IOFT).interfaceId || interfaceId == type(IERC20).interfaceId || super.supportsInterface(interfaceId);
    }

    function circulatingSupply() public view virtual override returns (uint) {
        return totalSupply();
    }

    function getAmountAndFee(uint _amount, uint16 _dstChainId) public view returns (uint amount, uint fee) {
        // universal overrides dstChainIdBp
        if (universalBp > 0) {
            fee = _amount * universalBp / BP_DENOMINATOR;
            amount = _amount - fee;

        } else if (dstChainIdBp[_dstChainId] > 0) {
            fee = _amount * dstChainIdBp[_dstChainId] / BP_DENOMINATOR;
            amount = _amount - fee;

        } else {
            fee = 0;
            amount = _amount;
        }
    }

    function setUniversalBp(uint _universalBp) external onlyOwner {
        require(_universalBp <= BP_DENOMINATOR,  "OFTFee: universalBp must be <= DP_DENOMINATOR");
        universalBp = _universalBp;
        emit SetUniversalBp(universalBp);
    }

    function setDstChainIdBp(uint16 _dstChainId, uint _dstChainIdBp) external onlyOwner {
        require(_dstChainIdBp <= BP_DENOMINATOR,  "OFTFee: dstChainIdBp must be <= DP_DENOMINATOR");
        dstChainIdBp[_dstChainId] = _dstChainIdBp;
        emit SetDstChainIdBp(_dstChainId, _dstChainIdBp);
    }

    function setFeeOwner(address _feeOwner) external onlyOwner {
        require(_feeOwner != address(0x0), "OFTFee: feeOwner cannot be 0x");
        feeOwner = _feeOwner;
        emit SetFeeOwner(_feeOwner);
    }

    function _debitFrom(address _from, uint16 _dstChainId, bytes memory, uint _amount) internal virtual override returns (uint) {
        address spender = _msgSender();
        if (_from != spender) _spendAllowance(_from, spender, _amount);

        (uint amount, uint fee) = getAmountAndFee(_amount, _dstChainId);
        if (fee > 0) _transfer(_from, owner(), fee); // payout the owner fee

        amount = _removeDust(amount); // removes the dust from amount to burn/send across chain

        _burn(_from, amount);
        return amount;
    }

    function _creditTo(uint16, address _toAddress, uint _amount) internal virtual override {
        _mint(_toAddress, _amount);
    }

    function _decimals() internal virtual override view returns (uint8) {
        return decimals();
    }
}
