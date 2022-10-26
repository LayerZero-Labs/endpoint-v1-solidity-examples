// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./OFTCoreV2.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract ProxyOFTV2 is OFTCoreV2 {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    uint8 internal immutable decimals;

    constructor(address _lzEndpoint, address _proxyToken, uint8 _sharedDecimals) OFTCoreV2(true, _sharedDecimals, _lzEndpoint) {
        token = IERC20(_proxyToken);

        (bool success, bytes memory data) = _proxyToken.staticcall(
            abi.encodeWithSignature("decimals()")
        );
        require(success, "ProxyOFT: failed to get token decimals");
        decimals = abi.decode(data, (uint8));
    }

    function circulatingSupply() public view virtual override returns (uint) {
        unchecked {
            return token.totalSupply() - token.balanceOf(address(this));
        }
    }

    function _debitFrom(address _from, uint16, bytes memory, uint _amount) internal virtual override returns (uint) {
        uint before = token.balanceOf(address(this));
        _transferFrom(_from, address(this), _amount);
        _amount = token.balanceOf(address(this)) - before;

        // it is still possible to have dust here if the token has transfer fee, then give the dust back to the sender
        (uint amount, uint dust) = _removeDust(_amount);
        if (dust > 0) token.safeTransfer(_from, dust);

        return amount;
    }

    function _creditTo(uint16, address _toAddress, uint _amount) internal virtual override {
        token.safeTransfer(_toAddress, _amount);
    }

    function _transferFrom(address _from, address _to, uint _amount) internal virtual override {
        require(_from == _msgSender(), "ProxyOFT: owner is not send caller");
        token.safeTransferFrom(_from, _to, _amount);
    }

    function _decimals() internal virtual override view returns (uint8) {
        return decimals;
    }
}
