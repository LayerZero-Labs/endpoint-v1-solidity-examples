// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./BaseOFTV2.sol";
import { ERC20 } from "solmate/tokens/ERC20.sol";
import { SafeTransferLib} from "solmate/utils/SafeTransferLib.sol";

contract ProxyOFTV2 is BaseOFTV2 {

    // Custom errors save gas
    error NoTokenDecimals();
    error SharedDecimalsTooLarge();
    error OwnerNotSendCaller();
    error OutboundAmountOverflow();

    using SafeTransferLib for ERC20;

    ERC20 internal immutable innerToken;
    uint internal immutable ld2sdRate;

    // total amount is transferred from this chain to other chains, ensuring the total is less than uint64.max in sd
    uint public outboundAmount;

    constructor(address _token, uint8 _sharedDecimals, address authority, address _lzEndpoint) BaseOFTV2(_sharedDecimals, authority, _lzEndpoint) {
        innerToken = ERC20(_token);

        (bool success, bytes memory data) = _token.staticcall(
            abi.encodeWithSignature("decimals()")
        );
        if (!success) revert NoTokenDecimals();
        uint8 decimals = abi.decode(data, (uint8));

        if (_sharedDecimals > decimals) revert SharedDecimalsTooLarge();
        ld2sdRate = 10 ** (decimals - _sharedDecimals);
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
        if (_from != msg.sender) revert OwnerNotSendCaller();

        _amount = _transferFrom(_from, address(this), _amount);

        // _amount still may have dust if the token has transfer fee, then give the dust back to the sender
        (uint amount, uint dust) = _removeDust(_amount);
        if (dust > 0) innerToken.safeTransfer(_from, dust);

        // check total outbound amount
        outboundAmount += amount;
        uint cap = _sd2ld(type(uint64).max);
        if (cap < outboundAmount) revert OutboundAmountOverflow();

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
        uint before = innerToken.balanceOf(_to);
        if (_from == address(this)) {
            innerToken.safeTransfer(_to, _amount);
        } else {
            innerToken.safeTransferFrom(_from, _to, _amount);
        }
        return innerToken.balanceOf(_to) - before;
    }

    function _ld2sdRate() internal view virtual override returns (uint) {
        return ld2sdRate;
    }
}
