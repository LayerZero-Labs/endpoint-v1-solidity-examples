// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../interfaces/IStargateRouter.sol";
import "../interfaces/IStargateRouterETH.sol";
import "../interfaces/IStargateFactory.sol";

contract PartnerSwap is ReentrancyGuard {
    IStargateRouter public immutable stargateRouter;
    IStargateRouterETH public immutable stargateEthRouter;
    IStargateFactory public immutable factory;
    uint256 public immutable DENOMINATOR = 1e18;

    struct FeeObj {
        uint256 feeNumerator;
        address feeCollector;
    }

    event PartnerSwapId(bytes16 indexed partnerId, uint256 feeNumerator, uint256 partnerFee);

    constructor(address _stargateRouter, address _stargateEthRouter, address _factory) {
        stargateRouter = IStargateRouter(_stargateRouter);
        stargateEthRouter = IStargateRouterETH(_stargateEthRouter);
        factory = IStargateFactory(_factory);
    }

    function swapTokens(
        uint16 _dstChainId,
        uint16 _srcPoolId,
        uint16 _dstPoolId,
        uint256 _amountLD,
        uint256 _minAmountLD,
        IStargateRouter.lzTxObj calldata _lzTxParams,
        bytes calldata _to,
        bytes16 _partnerId,
        FeeObj calldata _feeObj
    ) external nonReentrant payable {
        (uint256 amountToSwap, uint256 partnerFee) = _tokenApproveAndTransfer(_srcPoolId, _amountLD, _feeObj);

        stargateRouter.swap{value:msg.value}(
            _dstChainId,
            _srcPoolId,
            _dstPoolId,
            payable(msg.sender),
            amountToSwap,
            _minAmountLD,
            _lzTxParams,
            _to,
            "0x"
        );

        emit PartnerSwapId(_partnerId, _feeObj.feeNumerator, partnerFee);
    }

    function swapEth(
        uint16 _dstChainId,
        uint256 _amountLD,
        uint256 _minAmountLD,
        bytes calldata _to,
        bytes16 _partnerId,
        FeeObj calldata _feeObj
    ) external nonReentrant payable {
        (uint256 amountToSwap, uint256 partnerFee) = _ethApproveAndTransfer(_amountLD, _feeObj);

        stargateEthRouter.swapETH{value:amountToSwap}(
            _dstChainId,
            payable(msg.sender),
            _to,
            _amountLD - partnerFee,
            _minAmountLD
        );

        emit PartnerSwapId(_partnerId, _feeObj.feeNumerator, partnerFee);
    }

    function _tokenApproveAndTransfer(
        uint16 _srcPoolId,
        uint256 _amountLD,
        FeeObj calldata _feeObj
    ) internal returns (uint256 amountToSwap, uint256 partnerFee) {
        // calculate fees
        partnerFee = _amountLD * _feeObj.feeNumerator / DENOMINATOR;
        amountToSwap = _amountLD - partnerFee;

        // corresponding token to the poolId
        address token = factory.getPool(_srcPoolId).token();

        // move all the tokens to this contract
        IERC20(token).transferFrom(msg.sender, address(this), _amountLD);

        // pay the widget fee
        IERC20(token).transfer(_feeObj.feeCollector, partnerFee);

        // allow router to spend the tokens to be transferred
        IERC20(token).approve(address(stargateRouter), amountToSwap);

        return (amountToSwap, partnerFee);
    }

    function _ethApproveAndTransfer(
        uint256 _amountLD,
        FeeObj calldata _feeObj
    ) internal returns (uint256 amountToSwap, uint256 partnerFee) {
        // calculate fees
        partnerFee = _amountLD * _feeObj.feeNumerator / DENOMINATOR;
        require(msg.value > partnerFee, "PartnerSwap: not enough eth for fee");

        // calculate swap amount
        amountToSwap = msg.value - partnerFee;
        require(amountToSwap > _amountLD, "PartnerSwap: not enough eth for swap");

        // pay the widget fee
        (bool success, ) = _feeObj.feeCollector.call{value: partnerFee}("");
        require(success, "PartnerSwap: failed to transfer");

        return (amountToSwap, partnerFee);
    }
}