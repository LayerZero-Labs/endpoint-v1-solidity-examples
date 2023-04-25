// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./BaseOFTV2.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract ProxyOFTV2 is BaseOFTV2 {
    using SafeERC20 for IERC20;

    IERC20 internal immutable innerToken;
    uint internal immutable ld2sdRate;
    uint internal immutable cap;

    // total amount is transferred from this chain to other chains, ensuring the total is less than uint64.max in sd
    uint public outboundAmount;

    constructor(address _token, uint8 _sharedDecimals, address _lzEndpoint) BaseOFTV2(_sharedDecimals, _lzEndpoint) {
        innerToken = IERC20(_token);

        (bool success, bytes memory data) = _token.staticcall(
            abi.encodeWithSignature("decimals()")
        );
        require(success, "ProxyOFT: failed to get token decimals");
        uint8 decimals = abi.decode(data, (uint8));

        require(_sharedDecimals <= decimals, "ProxyOFT: sharedDecimals must be <= decimals");
        ld2sdRate = 10 ** (decimals - _sharedDecimals);
        cap = _sd2ld(type(uint64).max);
    }

    /************************************************************************
    * public functions
    ************************************************************************/
    function circulatingSupply() public view virtual override returns (uint) {
        return innerToken.totalSupply() - outboundAmount;
    }

    function token() public view virtual override returns (address) {
        return address(innerToken);
    }

    /************************************************************************
    * internal functions
    ************************************************************************/
    function _debitFrom(address _from, uint16, bytes32, uint _amount) internal virtual override returns (uint) {
        require(_from == _msgSender(), "ProxyOFT: owner is not send caller");

        _amount = _transferFrom(_from, address(this), _amount);

        // check total outbound amount
        outboundAmount += amount;
        require(cap >= outboundAmount, "ProxyOFT: outboundAmount overflow");

        return amount;
    }

    function _creditTo(uint16, address _toAddress, uint _amount) internal virtual override returns (uint) {
        outboundAmount -= _amount;

        // tokens are already in this contract, so no need to transfer
        if (_toAddress == address(this)) {
            return _amount;
        }

        return _transferFrom(address(this), _toAddress, _amount);
    }

    function _transferFrom(address _from, address _to, uint _amount) internal virtual override returns (uint) {
        if (_from == address(this)) {
            innerToken.safeTransfer(_to, _amount);
        } else {
            innerToken.safeTransferFrom(_from, _to, _amount);
        }
        return _amount;
    }

    function _ld2sdRate() internal view virtual override returns (uint) {
        return ld2sdRate;
    }
}
