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
task(
    "ocSetTrustedRemote",
    "setTrustedRemote(chainId, sourceAddr) to allow the local contract to receive messages from known source contracts",
    require("./ocSetTrustedRemote")
).addParam("targetNetwork", "the target network to let this instance receive messages from")

//
task(
    "oftSetTrustedRemote",
    "setTrustedRemote(chainId, sourceAddr) to enable inbound/outbound messages with your other contracts",
    require("./oftSetTrustedRemote")
)
    .addParam("targetNetwork", "the target network to set as a trusted remote")

//
task(
    "oftSend",
    "basedOFT.send()  tokens to another chain",
    require("./oftSend")
)
    .addParam("qty", "qty of tokens to send")
    .addParam("targetNetwork", "the target network to let this instance receive messages from")

//
task(
    "onftSetTrustedRemote",
    "setTrustedRemote(chainId, sourceAddr) to allow the local contract to send/receive messages from known source contracts",
    require("./onftSetTrustedRemote")
)
    .addParam("targetNetwork", "the target network to let this instance receive messages from")

//
task("onftOwnerOf", "ownerOf(tokenId) to get the owner of a token", require("./onftOwnerOf")).addParam(
    "tokenId",
    "the tokenId of ONFT"
)

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

task("pingPongSetTrustedRemote", "set the trusted remote", require("./pingPongSetTrustedRemote")).addParam(
    "targetNetwork",
    "the targetNetwork to set as trusted"
)

task("ping", "call ping to start the pingPong with the target network", require("./ping")).addParam(
    "targetNetwork",
    "the targetNetwork to commence pingponging with"
)
