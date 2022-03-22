// for example purposes
task("deployOmniChainToken", "deploys a OmniChainToken")
    .addParam("name", "the string name of the token")
    .addParam("symbol", "the string symbol of the token")
    .addParam("lzendpoint", "the LayerZero endpoint on the chain you are deploying to")
    .setAction(async (taskArgs) => {
            let OmniChainToken = await ethers.getContractFactory('OmniChainToken');
            let omniChainToken = await OmniChainToken.deploy(taskArgs.name, taskArgs.symbol, taskArgs.lzendpoint);
            console.log(`omniChainToken.address: ${omniChainToken.address}`);
    });

task("deployPingPong", "deploy an instance of PingPong.sol")
    .addParam("endpoint", "LayerZero Communicator.sol instance, what we call the 'endpoint'")
    .setAction(async (taskArgs) => {

        let signers = await ethers.getSigners();
        let owner = signers[0];
        console.log(`owner.address: ${owner.address}`);

        //--------------- DocsCounterMock -----------------------------------------------
        const PingPong = await ethers.getContractFactory("PingPong");
        const pingPong = await PingPong.deploy(taskArgs.endpoint);
        await pingPong.deployed();
        console.log("pingPong.address:", pingPong.address);
    });

task("incrementOmniChainCounter", "increment the counter of a destination OmniChainCounter.sol")
    .addParam("src", "the source address of the local OmniChainToken")
    .addParam("chainId", "the destination chainId")
    .addParam("dst", "the dst address of the local OmniChainToken")
    .setAction(async (taskArgs) => {
        //--------------- OmniChainCounter -----------------------------------------------
        const OmniChainCounter = await ethers.getContractFactory("OmniChainCounter");
        const omniChainCounter = await OmniChainCounter.attach(taskArgs.src);
        console.log("src omniChainCounter.address:", omniChainCounter.address);

        // send the increment counter call to the destination contract
        let tx = await(await omniChainCounter.incrementCounter(
            taskArgs.chainId,
            taskArgs.dst,
            { value: ethers.utils.parseEther('0.1') }
        )).wait()
        console.log(`tx: ${tx.transactionHash}`)
    });

// set the Oracle address for the OmniCounter
task("omniCounterSetOracle", "set the UA (an OmniCounter contract) to use the specified oracle for the destination chain",
    require("./omniCounterSetOracle"))
    .addParam("targetNetwork", "the target network name, ie: fuji, or mumbai, etc (from hardhat.config.js)")
    .addParam("oracle", "the Oracle address for the specified targetNetwork")

// get the Oracle for sending to the destination chain
task("omniCounterGetOracle", "get the Oracle address being used by the OmniCounter",
    require("./omniCounterGetOracle"))
    .addParam("targetNetwork", "the target network name, ie: fuji, or mumbai, etc (from hardhat.config.js)")

//
task("omniCounterIncrementCounter", "increment the destination OmniCounter",
    require("./omniCounterIncrementCounter"))
    .addParam("targetNetwork", "the target network name, ie: fuji, or mumbai, etc (from hardhat.config.js)")
    .addOptionalParam("n", "number of tx", 1, types.int)

//
task("omniCounterIncrementMultiCounter", "increment the destination OmniCounter",
    require("./omniCounterIncrementMultiCounter"))
    .addParam("targetNetworks", "target network names, separated by comma (no spaces)")

//
task("omniCounterSetRemote", "setRemote(chainId, remoteAddr) to allow the local contract to receive messages from known remote contracts",
    require("./omniCounterSetRemote"))
    .addParam("targetNetwork", "the target network to let this instance receive messages from")

//
task("omniCounterPoll", "poll the counter of the OmniCounter",
    require("./omniCounterPoll"))

task("omniChainTokenSetRemote", "setRemote() so the local contract can receive messages from the remote",
    require("./omniChainTokenSetRemote"))
    .addParam("targetNetwork", "the target network to let this instance receive messages from")

task("omniChainTokenSendTokens", "omniChainTokenSendTokens() send tokens to another chain",
    require("./omniChainTokenSendTokens"))
    .addParam("qty", "qty of tokens to send")
    .addParam("targetNetwork", "the target network to let this instance receive messages from")

task("omniCounterIncrementWithParamsV1", "increment the destination OmniCounter with gas amount param",
    require("./omniCounterIncrementWithParamsV1"))
    .addParam("targetNetwork", "the target network name, ie: fuji, or mumbai, etc (from hardhat.config.js)")
    .addParam("gasAmount", "the gas amount for the destination chain")

task("omniCounterIncrementWithParamsV2", "increment the destination OmniCounter with gas amount param",
    require("./omniCounterIncrementWithParamsV2"))
    .addParam("targetNetwork", "the target network name, ie: fuji, or mumbai, etc (from hardhat.config.js)")
    .addParam("gasAmount", "the gas amount for the destination chain")
    .addParam("airDropEthQty", "the amount of eth to drop")
    .addParam("airDropAddr", "the air drop address")

task("deleteAndRedeploy", "remove contracts from folder and redeploy", require("./deleteAndRedeploy"))
    .addParam("e", "the environment ie: mainnet, testnet")
    .addOptionalParam("contract", "the contract to delete and redeploy")
    .addOptionalParam("ignore", "csv of network names to ignore", "", types.string)