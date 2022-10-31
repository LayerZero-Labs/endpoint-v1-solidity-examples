// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./OFTCoreV2.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract ProxyOFTV2 is OFTCoreV2 {
    using SafeERC20 for IERC20;

    IERC20 internal immutable innerToken;
    uint internal immutable ld2sdRate;

    // total amount in sd is transferred from this chain to other chains, ensuring the total is less than max of uint64
    uint64 public outboundAmountSD;

    constructor(address _token, uint8 _sharedDecimals, address _lzEndpoint) OFTCoreV2(_sharedDecimals, _lzEndpoint) {
        innerToken = IERC20(_token);

        (bool success, bytes memory data) = _token.staticcall(
            abi.encodeWithSignature("decimals()")
        );
        require(success, "ProxyOFT: failed to get token decimals");
        uint8 decimals = abi.decode(data, (uint8));

        require(_sharedDecimals <= decimals, "ProxyOFT: sharedDecimals must be <= decimals");
        ld2sdRate = 10 ** (decimals - _sharedDecimals);
    }

    function circulatingSupply() public view virtual override returns (uint) {
        unchecked {
            return innerToken.totalSupply() - innerToken.balanceOf(address(this));
        }
    }

    function token() public view virtual override returns (address) {
        return address(innerToken);
    }

    function _debitFrom(address _from, uint16, bytes memory, uint _amount) internal virtual override returns (uint) {
        uint before = innerToken.balanceOf(address(this));
        _transferFrom(_from, address(this), _amount);
        _amount = innerToken.balanceOf(address(this)) - before;

        // _amount still may have dust if the token has transfer fee, then give the dust back to the sender
        (uint amount, uint dust) = _removeDust(_amount);
        if (dust > 0) innerToken.safeTransfer(_from, dust);

        // check total outbound amount
        uint64 amountSD = _ld2sd(amount);
        require(type(uint64).max - outboundAmountSD >= amountSD, "ProxyOFT: outboundAmountSD overflow");
        outboundAmountSD += amountSD;

        return amount;
    }

    function _creditTo(uint16, address _toAddress, uint _amount) internal virtual override {
        innerToken.safeTransfer(_toAddress, _amount);
        outboundAmountSD -= _ld2sd(_amount);
    }

    function _transferFrom(address _from, address _to, uint _amount) internal virtual override {
        require(_from == _msgSender(), "ProxyOFT: owner is not send caller");
        innerToken.safeTransferFrom(_from, _to, _amount);
    }

    function _ld2sdRate() internal view virtual override returns (uint) {
        return ld2sdRate;
    }
}
