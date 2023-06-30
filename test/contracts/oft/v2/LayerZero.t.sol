pragma solidity 0.8.20;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import { ExampleOFTV2 } from "../../../../contracts/examples/ExampleOFTV2.sol";
import "../../../../contracts/mocks/LZEndpointMock.sol";
import "../../../../contracts/token/oft/v2/ICommonOFT.sol";

contract LayerZeroTest is Test {

    // LayerZero Ids
    uint16 constant ETH_ID = 101;
    uint16 constant GOERLI_ID = 10_121;
    uint16 constant POLYGON_ID = 109;
    uint16 constant ARBITRUM_ID = 110;


    ExampleOFTV2 public polyMevEth;
    ExampleOFTV2 public arbMevEth;
    LZEndpointMock polygonEndpoint;
    LZEndpointMock arbitrumEndpoint;

    address gov;
    uint initSupply;

    function setUp() public {
        gov = address(this);
        initSupply = 2_000_000 ether;
        uint8 sharedDecimals = 8;
        //  setup mocks
        polygonEndpoint = new LZEndpointMock(POLYGON_ID);
        // deploy mevEth (polygon)
        polyMevEth = new ExampleOFTV2(address(polygonEndpoint), initSupply, sharedDecimals);

        // simulate deploy OFT on arbitrum
        arbitrumEndpoint = new LZEndpointMock(ARBITRUM_ID);
        arbMevEth = new ExampleOFTV2(address(arbitrumEndpoint), 0, sharedDecimals);

        // set trusted remotes
        arbMevEth.setTrustedRemote(POLYGON_ID, abi.encodePacked(address(polyMevEth), address(arbMevEth)));
        polyMevEth.setTrustedRemote(ARBITRUM_ID, abi.encodePacked(address(arbMevEth), address(polyMevEth)));
        // internal bookkeeping for endpoints (not part of a real deploy, just for this test)
        arbitrumEndpoint.setDestLzEndpoint(address(polyMevEth), address(polygonEndpoint));
        polygonEndpoint.setDestLzEndpoint(address(arbMevEth), address(arbitrumEndpoint));
    }

    /// @notice test send mevEth token cross chain through mock lz endpoint
    function testSendFrom() public {
        address User02 = address(2);
        uint256 amount = 1 ether;
        vm.startPrank(gov);

        // Check the user has initSupply      
        assertEq(polyMevEth.balanceOf(gov), initSupply);

        // Check that the mevETH contract has initSupply
        assertEq(polyMevEth.totalSupply(), initSupply);

        // setup call params
        ICommonOFT.LzCallParams memory callParams;
        callParams.refundAddress = payable(gov);
        callParams.zroPaymentAddress = address(0);
        callParams.adapterParams = "";
        // call estimate send fee
        (uint256 nativeFee,) = polyMevEth.estimateSendFee(ARBITRUM_ID, _addressToBytes32(User02), amount, false, "");
        // send tokens from mainnet to simulated arbitrum
        vm.deal(gov, nativeFee);
        polyMevEth.sendFrom{ value: nativeFee }(gov, ARBITRUM_ID, _addressToBytes32(User02), amount, callParams);

        assertEq(arbMevEth.totalSupply(), amount);
        assertEq(arbMevEth.balanceOf(User02), amount);

        vm.stopPrank();
        vm.startPrank(User02);
        // send funds back
        // setup call params
        callParams.refundAddress = payable(User02);
        callParams.zroPaymentAddress = address(0);
        callParams.adapterParams = "";
        // call estimate send fee
        (nativeFee,) = arbMevEth.estimateSendFee(POLYGON_ID, _addressToBytes32(gov), amount, false, "");
        // send tokens back to mainnet from simulated arbitrum
        vm.deal(User02, nativeFee);
        arbMevEth.sendFrom{ value: nativeFee }(User02, POLYGON_ID, _addressToBytes32(gov), amount, callParams);

        assertEq(polyMevEth.totalSupply(), initSupply);
        assertEq(polyMevEth.balanceOf(gov), initSupply);
    }

    function _addressToBytes32(address _address) internal pure virtual returns (bytes32) {
        return bytes32(uint256(uint160(_address)));
    }
}
