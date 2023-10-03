// set the Oracle address for the OmniCounter
// example:
task("omniCounterSetOracle", "set the UA (an OmniCounter contract) to use the specified oracle for the destination chain", require("./omniCounterSetOracle"))
    .addParam("targetNetwork", "the target network name, ie: fuji, or mumbai, etc (from hardhat.config.js)")
    .addParam("oracle", "the Oracle address for the specified targetNetwork")

// get the Oracle for sending to the destination chain
task("ocGetOracle", "get the Oracle address being used by the OmniCounter", require("./ocGetOracle")).addParam("targetNetwork", "the target network name, ie: fuji, or mumbai, etc (from hardhat.config.js)")

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

//
task("checkWireUp", "check wire up", require("./checkWireUp"))
    .addParam("e", "environment testnet/mainet")
    .addParam("contract", "the contract to delete and redeploy")

//
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
    .addOptionalParam("localContract", "Name of local contract if the names are different")
    .addOptionalParam("remoteContract", "Name of remote contract if the names are different")
    .addOptionalParam("contract", "If both contracts are the same name")

//
task("oftSend", "send tokens to another chain", require("./oftSend"))
    .addParam("qty", "qty of tokens to send")
    .addParam("targetNetwork", "the target network to let this instance receive messages from")
    .addOptionalParam("localContract", "Name of local contract if the names are different")
    .addOptionalParam("remoteContract", "Name of remote contract if the names are different")
    .addOptionalParam("contract", "If both contracts are the same name")

//
task("oftv2Send", "send tokens to another chain", require("./oftv2Send"))
    .addParam("qty", "qty of tokens to send")
    .addParam("targetNetwork", "the target network to let this instance receive messages from")
    .addOptionalParam("localContract", "Name of local contract if the names are different")
    .addOptionalParam("remoteContract", "Name of remote contract if the names are different")
    .addOptionalParam("contract", "If both contracts are the same name")

//
task("onftMint", "mint() mint ONFT", require("./onftMint"))
    .addParam("contract", "Name of contract")

//
task("ownerOf", "ownerOf(tokenId) to get the owner of a token", require("./ownerOf"))
    .addParam("contract", "Name of contract")
    .addParam("tokenId", "the tokenId of ONFT")

//
task("onftSend", "send an ONFT nftId from one chain to another", require("./onftSend"))
    .addParam("tokenId", "the tokenId of ONFT")
    .addParam("targetNetwork", "the chainId to transfer to")
    .addParam("contract", "ONFT contract name")

//
task("setMinDstGas", "set min gas required on the destination gas", require("./setMinDstGas"))
    .addParam("packetType", "message Packet type")
    .addParam("targetNetwork", "the chainId to transfer to")
    .addParam("contract", "contract name")
    .addParam("minGas", "min gas")

//
task("incrementCounter", "increment the destination OmniCounter", require("./incrementCounter"))
    .addParam("targetNetwork", "the target network name, ie: fuji, or mumbai, etc (from hardhat.config.js)")

// npx hardhat deployWireCheck --e testnet --contract ExampleOFT --proxy-contract ExampleBasedOFT --proxy-chain optimism-kovan
// npx hardhat deployWireCheck --e testnet --contract ExampleUniversalONFT721
task("deployWireCheck", "", require("./deployWireCheck"))
    .addParam("e", "environment testnet/mainet")
    .addParam("contract", "")
    .addOptionalParam("proxyChain", "")
    .addOptionalParam("proxyContract", "")

task("verifyContract", "", require("./verifyContract.js"))
    .addParam("contract", "contract name")

//
task("getStoredPayloadEvent", "Detect and clear stored payload", require('./getStoredPayloadEvent'))
    .addParam("txStart", "provide a transaction hash in the block you want to start in")
    .addParam("srcAddress", "")
    .addParam("desAddress", "")
    .addOptionalParam("txEnd", "provide a tx hash in the block you want to end at")
    .addOptionalParam("step", "provide a tx hash in the block you want to end at", 1000, types.int)
    .addOptionalParam("nonce", "nonce to clear")

//
task("getMessageFailedEvent", "Detect and clear failed message", require('./getMessageFailedEvent'))
    .addParam("txStart", "provide a transaction hash in the block you want to start in")
    .addParam("dstUa", "address of dst UA")
    .addOptionalParam("txEnd", "provide a tx hash in the block you want to end at")
    .addOptionalParam("step", "provide a tx hash in the block you want to end at", 1000, types.int)
    .addOptionalParam("nonce", "nonce to clear")

//
task("isFailedMessage", "check if failed message", require("./isFailedMessage"))
    .addParam("srcChainId", "")
    .addParam("srcAddress", "")
    .addParam("desAddress", "")
    .addParam("nonce", "")

//
task("isStoredPayload", "check if stored payload", require("./isStoredPayload"))
    .addParam("srcChainId", "")
    .addParam("srcAddress", "")
    .addParam("desAddress", "")
    .addOptionalParam("payload", "")
    .addOptionalParam("clear", "", false, types.boolean)

task("cachedSwapSavedParse", "", require("./cachedSwapSavedParse"))
    .addParam("srcNetwork", "src network of tx")
    .addParam("nonce", "nonce of source tx")
    .addParam("uaPayload", "ua payload")
    .addOptionalParam("clear", "clear cachedSwapSaved via StargateComposer", false, types.boolean)
// npx hardhat --network NETWORK cachedSwapSavedParse --src-network SRC_NETWORK --nonce NONCE --ua-payload UA_PAYLOAD --clear BOOL
// npx hardhat --network optimism cachedSwapSavedParse --src-network arbitrum --nonce 3003978 --ua-payload 0x00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000704e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a959191ab8300000000000000000000000000000000000000000000000000000000005b7f7000000000000000000000000000000000000000000000000000000000000000b4000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000d5c00000000000000000000000000000000000000000000000000000000005b8d8000000000000000000000000000000000000000000000000000000000000001c000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000014ecc19e177d24551aa7ed6bc6fe566eca726cc8a900000000000000000000000000000000000000000000000000000000000000000000000000000000000000a869a705a1450219564071ffa47d9afe2bd5a44b53c9155e8102e2c080ee8363f00762bdfeedc9e7f1000000000000000000000000d8ce31e7b623fede0c881fbb8c7397773c55e4fd000000000000000000000000af19de113b181668a516e7639a3872930fa15ebd000000000000000000000000000000000000000000000000000000000000006e000000000000000000000000af19de113b181668a516e7639a3872930fa15ebd000000000000000000000000000000000000000000000000