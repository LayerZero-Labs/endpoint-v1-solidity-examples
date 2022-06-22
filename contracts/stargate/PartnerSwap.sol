// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../interfaces/IStargateRouter.sol";
import "../interfaces/IStargateFactory.sol";

contract PartnerSwap is ReentrancyGuard {
    IStargateRouter public immutable stargateRouter;
    IStargateFactory public immutable factory;
    uint256 public immutable DENOMINATOR = 1e18;

    struct SwapObj {
        uint256 bps;
        address feeCollector;
    }

    constructor(address _stargateRouter, address _factory) {
        stargateRouter = IStargateRouter(_stargateRouter);
        factory = IStargateFactory(_factory);
    }

    //-----------------------------------------------------------------------------------------------------------------------
    // swap tokens to another chain
    function swap(
        uint16 _dstChainId,
        uint16 _srcPoolId,
        uint16 _dstPoolId,
        uint256 _amountLD,
        IStargateRouter.lzTxObj calldata _lzTxParams,
        bytes calldata _to,
        bytes calldata _payload,
        SwapObj calldata _swapObj
    ) external nonReentrant payable {
        uint256 amountToSwap = _tokenApproveAndTransfer(_srcPoolId, _amountLD, _swapObj);

        stargateRouter.swap{value:msg.value}(
            _dstChainId,
            _srcPoolId,
            _dstPoolId,
            payable(msg.sender),
            amountToSwap,
            amountToSwap,
            _lzTxParams,
            _to,
            _payload
        );
    }

    function _tokenApproveAndTransfer(
        uint16 _srcPoolId,
        uint256 _amountLD,
        SwapObj calldata _swapObj
    ) internal returns (uint256 amountToSwap) {
        // calculate fees
        uint256 bpFee = _amountLD * _swapObj.bps / DENOMINATOR;
        amountToSwap = _amountLD - bpFee;

        // corresponding token to the poolId
        address token = factory.getPool(_srcPoolId).token();

        // move all the tokens to this contract
        IERC20(token).transferFrom(msg.sender, address(this), _amountLD);

        // pay the widget fee
        IERC20(token).transfer(_swapObj.feeCollector, bpFee);

        // allow router to spend the tokens to be transferred
        IERC20(token).approve(address(stargateRouter), amountToSwap);

        return amountToSwap;
    }
}