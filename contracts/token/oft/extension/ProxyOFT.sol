pragma solidity ^0.8.0;

import "../../../lzApp/NonblockingLzApp.sol";
import "../OFT.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// this is a OFT proxy to interact with other OFT contracts
// all other OFT contracts MUST initiate with 0 supply
contract ProxyOFT is OFT{
    using SafeERC20 for IERC20;

    IERC20 immutable public token;

    constructor (
        string memory _name,
        string memory _symbol,
        address _lzEndpoint,
        address _proxyToken) OFT(_name, _symbol, _lzEndpoint, 0){
        token = IERC20(_proxyToken);
    }

    /**
     * @dev
     * for sendTokens, users need to approve this contract some `token` allowance
     * for sendTokensFrom, users need to approve this contract some `token` allowance
     *      and approve this contract some `ProxyOFT` allowance
     */
    function _beforeSendTokens(
        address _from,
        uint16 _dstChainId,
        bytes memory _toAddress,
        uint256 _amount
    ) internal override {
        token.safeTransferFrom(_from, address(this), _amount);
    }

    function _afterReceiveTokens(
        uint16 _dstChainId,
        address _toAddress,
        uint256 _amount
    ) internal override {
        token.safeTransfer(_toAddress, _amount);
    }

    // using the proxy Token's total supply as source of truth
    function totalSupply() public view virtual override returns (uint256) {
        return token.totalSupply();
    }
}
