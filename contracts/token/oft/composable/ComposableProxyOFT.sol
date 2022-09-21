// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./ComposableOFTCore.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract ComposableProxyOFT is ComposableOFTCore {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;

    event Approval(address indexed owner, address indexed spender, uint256 value);

    // user -> wrapper -> amount
    mapping(address => mapping(address => uint256)) public allowances;

    constructor(address _lzEndpoint, address _proxyToken) ComposableOFTCore(_lzEndpoint) {
        token = IERC20(_proxyToken);
    }

    function circulatingSupply() public view virtual override returns (uint) {
        unchecked {
            return token.totalSupply() - token.balanceOf(address(this));
        }
    }

    // if the _from calling through another wrapper contract,
    // 1/ the _from needs to approve the allowance of the wrapper contract.
    // 2/ and the _from needs to approve this contract to spend his erc20
    function _debitFrom(address _from, uint16, bytes memory, uint _amount) internal virtual override {
        address spender = _msgSender();
        if (_from != spender) _spendAllowance(_from, spender, _amount);
        // transfer token from _from to this contract
        token.safeTransferFrom(_from, address(this), _amount);
    }

    function _creditTo(uint16, address _toAddress, uint _amount) internal virtual override {
        token.safeTransfer(_toAddress, _amount);
    }

    // approve allowance - user approves the wrapper contract to spend on his behalf
    function approve(address spender, uint256 amount) public returns (bool) {
        address owner = _msgSender();
        _approve(owner, spender, amount);
        return true;
    }

    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) internal virtual {
        require(owner != address(0), "ComposableProxyOFT: approve from the zero address");
        require(spender != address(0), "ComposableProxyOFT: approve to the zero address");

        allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function _spendAllowance(
        address owner,
        address spender,
        uint256 amount
    ) internal virtual {
        uint256 currentAllowance = allowances[owner][spender];
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= amount, "ComposableProxyOFT: insufficient allowance");
            unchecked {
                _approve(owner, spender, currentAllowance - amount);
            }
        }
    }
}
