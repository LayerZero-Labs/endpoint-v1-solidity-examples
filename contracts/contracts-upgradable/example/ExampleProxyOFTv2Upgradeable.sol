// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../token/oft/v2/ProxyOFTV2Upgradable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract ExampleProxyOFTv2Upgradeable is ProxyOFTV2Upgradable {
    function initialize(address _token, uint8 _sharedDecimals, address _lzEndpoint) external initializer {
        __ProxyOFTV2Upgradable_init(_token, _sharedDecimals, _lzEndpoint);
    }
}
