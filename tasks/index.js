// set the Oracle address for the OmniCounter
task(
    "omniCounterSetOracle",
    "set the UA (an OmniCounter contract) to use the specified oracle for the destination chain",
    require("./omniCounterSetOracle")
)
    .addParam("targetNetwork", "the target network name, ie: fuji, or mumbai, etc (from hardhat.config.js)")
    .addParam("oracle", "the Oracle address for the specified targetNetwork")

// get the Oracle for sending to the destination chain
task("ocGetOracle", "get the Oracle address being used by the OmniCounter", require("./ocGetOracle")).addParam(
    "targetNetwork",
    "the target network name, ie: fuji, or mumbai, etc (from hardhat.config.js)"
)

//
task("ocIncrementCounter", "increment the destination OmniCounter", require("./ocIncrementCounter"))
    .addParam("targetNetwork", "the target network name, ie: fuji, or mumbai, etc (from hardhat.config.js)")
    .addOptionalParam("n", "number of tx", 1, types.int)

//
task("omniCounterIncrementMultiCounter", "increment the destination OmniCounter", require("./omniCounterIncrementMultiCounter")).addParam(
    "targetNetworks",
    "target network names, separated by comma (no spaces)"
)

//
task("oftSend", "basedOFT.send()  tokens to another chain", require("./oftSend"))
    .addParam("qty", "qty of tokens to send")
    .addParam("targetNetwork", "the target network to let this instance receive messages from")

//
task(
    "onftSetTrustedRemote",
    "setTrustedRemote(chainId, sourceAddr) to allow the local contract to send/receive messages from known source contracts",
    require("./onftSetTrustedRemote")
).addParam("targetNetwork", "the target network to let this instance receive messages from")

//
task("onftOwnerOf", "ownerOf(tokenId) to get the owner of a token", require("./onftOwnerOf")).addParam("tokenId", "the tokenId of ONFT")

//
task("onftMint", "mint() mint ONFT", require("./onftMint"))

//
task("onftSend", "send an ONFT nftId from one chain to another", require("./onftSend"))
    .addParam("targetNetwork", "the chainId to transfer to")
    .addParam("tokenId", "the tokenId of ONFT")

//
task("ocPoll", "poll the counter of the OmniCounter", require("./ocPoll"))

//
task(
    "omniCounterIncrementWithParamsV1",
    "increment the destination OmniCounter with gas amount param",
    require("./omniCounterIncrementWithParamsV1")
)
    .addParam("targetNetwork", "the target network name, ie: fuji, or mumbai, etc (from hardhat.config.js)")
    .addParam("gasAmount", "the gas amount for the destination chain")

//
task(
    "omniCounterIncrementWithParamsV2",
    "increment the destination OmniCounter with gas amount param",
    require("./omniCounterIncrementWithParamsV2")
)
    .addParam("targetNetwork", "the target network name, ie: fuji, or mumbai, etc (from hardhat.config.js)")
    .addParam("gasAmount", "the gas amount for the destination chain")
    .addParam("airDropEthQty", "the amount of eth to drop")
    .addParam("airDropAddr", "the air drop address")

// task("deleteAndRedeploy", "remove contracts from folder and redeploy", require("./deleteAndRedeploy"))
//     .addParam("e", "the environment ie: mainnet, testnet")
//     .addOptionalParam("contract", "the contract to delete and redeploy")
//     .addOptionalParam("ignore", "csv of network names to ignore", "", types.string)

task("routerAddLiquidityETH", "addLiquidityETH to the V2 Router", require("./routerAddLiquidityETH"))
    .addParam("router", "the router address")
    .addParam("token", "the token address")

task("swapNativeForNative", "swap native on one chain thru StargateComposed to native on another chainr", require("./swapNativeForNative"))
    .addParam("targetNetwork", "the destination network name")
    .addParam("bridgeToken", "the address of the token that will be bridged (the pools token)")
    .addParam("srcPoolId", "the poolId to bridge")
    .addParam("dstPoolId", "the poolId to bridge")
    .addParam("qty", "the quanitty of native to swap in")

task("pingPongSetTrustedRemote", "set the trusted remote", require("./pingPongSetTrustedRemote")).addParam(
    "targetNetwork",
    "the targetNetwork to set as trusted"
)

task("ping", "call ping to start the pingPong with the target network", require("./ping")).addParam(
    "targetNetwork",
    "the targetNetwork to commence pingponging with"
)

task("getSigners", "show the signers of the current mnemonic", require("./getSigners")).addOptionalParam("n", "how many to show", 3, types.int)

task("approveERC1155", "approve it to transfer my nfts", require("./approveERC1155")).addParam("addr", "the address to approve")

task("sendProxyONFT1155", "send a tokenid and quantity", require("./sendProxyONFT1155"))
    .addParam("targetNetwork", "the destination chainId")
    .addParam("tokenId", "the NFT tokenId")
    .addParam("quantity", "the quantity of NFT tokenId to send")
// .addParam("msgValue", "the lz message value, ie: '0.02' ")

task("sendONFT1155", "send a tokenid and quantity", require("./sendONFT1155"))
    .addParam("targetNetwork", "the destination chainId")
    .addParam("tokenId", "the NFT tokenId")
    .addParam("quantity", "the quantity of NFT tokenId to send")
    .addParam("msgValue", "the lz message value, ie: '0.02' ")

task("batchSendProxyONFT1155", "send a tokenid and quantity", require("./batchSendProxyONFT1155"))
    .addParam("targetNetwork", "the destination chainId")
    .addParam("tokenIds", "the NFT tokenId")
    .addParam("quantities", "the quantity of NFT tokenId to send")

task("batchSendONFT1155", "send a tokenid and quantity", require("./batchSendONFT1155"))
    .addParam("targetNetwork", "the destination chainId")
    .addParam("tokenIds", "the NFT tokenId")
    .addParam("quantities", "the quantity of NFT tokenId to send")

task("WireProxyOft", "wire some proxy oft", require("./WireProxyOft"))

// uint qty,
// address bridgeToken,                    // the address of the native ERC20 to swap() - *must* be the token for the poolId
// uint16 dstChainId,                      // Stargate/LayerZero chainId
// uint16 srcPoolId,                       // stargate poolId - *must* be the poolId for the qty asset
// uint16 dstPoolId,                       // stargate destination poolId
task("stargateSwap", "", require("./stargateSwap"))
    .addParam("qty", "")
    .addParam("bridgeToken", "")
    .addParam("targetNetwork", "")
    .addParam("srcPoolId", "")
    .addParam("dstPoolId", "")


// npx hardhat checkWireUp --e testnet --contract OmniCounter
task("checkWireUp", "check wire up", require("./checkWireUp"))
    .addParam("e", "environment testnet/mainet")
    .addParam("contract", "the contract to delete and redeploy")

// npx hardhat checkWireUpAll --e testnet --contract OmniCounter
// npx hardhat checkWireUpAll --e testnet --trusted-remote-version 1 --contract ONFT1155 --proxy-contract ONFT1155Mint --proxy-chain optimism-kovan
task("checkWireUpAll", "check wire up all", require("./checkWireUpAll"))
    .addParam("e", "environment testnet/mainet")
    .addParam("contract", "name of contract")
    .addOptionalParam("proxyContract", "name of proxy contract")
    .addOptionalParam("proxyChain", "name of proxy chain")

//
task(
    "setTrustedRemote",
    "setTrustedRemote(chainId, sourceAddr) to enable inbound/outbound messages with your other contracts",
    require("./setTrustedRemote")
).addParam("targetNetwork", "the target network to set as a trusted remote")
    .addOptionalParam("localContract", "")
    .addOptionalParam("remoteContract", "")

//
task(
    "setTrustedRemoteAddress",
    "setTrustedRemoteAddress(chainId, sourceAddr) to enable inbound/outbound messages with your other contracts",
    require("./setTrustedRemoteAddress")
).addParam("targetNetwork", "the target network to set as a trusted remote")
    .addOptionalParam("localContract", "")
    .addOptionalParam("remoteContract", "")

// npx hardhat deployWireCheck --e testnet --contract ExampleUniversalONFT721
// npx hardhat deployWireCheck --e testnet --contract OFT --proxy-chain fuji --proxy-contract ProxyOFT
// npx hardhat deployWireCheck --e testnet --contract ReceiveONFT721 --proxy-chain fuji --proxy-contract DistributeONFT721
// npx hardhat deployWireCheck --e testnet --trusted-remote-version 1 --contract ExampleOFT --proxy-contract ExampleBasedOFT --proxy-chain optimism-kovan
// npx hardhat deployWireCheck --e testnet --trusted-remote-version 1 --contract ExampleUniversalONFT721

task("deployWireCheck", "", require("./deployWireCheck"))
    .addParam("e", "environment testnet/mainet")
    .addParam("contract", "")
    .addParam("trustedRemoteVersion", "name of contract")
    .addOptionalParam("proxyChain", "")
    .addOptionalParam("proxyContract", "")