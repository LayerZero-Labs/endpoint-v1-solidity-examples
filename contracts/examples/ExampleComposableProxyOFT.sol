// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../token/oft/composable/ComposableProxyOFT.sol";

contract ExampleComposableProxyOFT is ComposableProxyOFT {
    constructor(address _layerZeroEndpoint, address _proxyToken) ComposableProxyOFT(_layerZeroEndpoint, _proxyToken) {}
}
