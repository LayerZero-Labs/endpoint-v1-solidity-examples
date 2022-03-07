// for example purposes
task("deployMultiChainToken", "deploys a MultiChainToken")
    .addParam("name", "the string name of the token")
    .addParam("symbol", "the string symbol of the token")
    .addParam("lzendpoint", "the LayerZero endpoint on the chain you are deploying to")
    .setAction(async (taskArgs) => {
            let MultiChainToken = await ethers.getContractFactory('MultiChainToken');
            let multiChainToken = await MultiChainToken.deploy(taskArgs.name, taskArgs.symbol, taskArgs.lzendpoint);
            console.log(`multiChainToken.address: ${multiChainToken.address}`);
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

task("incrementMultiChainCounter", "increment the counter of a destination MultiChainCounter.sol")
    .addParam("src", "the source address of the local MultiChainToken")
    .addParam("chainId", "the destination chainId")
    .addParam("dst", "the dst address of the local MultiChainToken")
    .setAction(async (taskArgs) => {
        //--------------- MultiChainCounter -----------------------------------------------
        const MultiChainCounter = await ethers.getContractFactory("MultiChainCounter");
        const multiChainCounter = await MultiChainCounter.attach(taskArgs.src);
        console.log("src multiChainCounter.address:", multiChainCounter.address);

        // send the increment counter call to the destination contract
        let tx = await(await multiChainCounter.incrementCounter(
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
task("omniCounterIncrement", "increment the destination OmniCounter",
    require("./omniCounterIncrement"))
    .addParam("targetNetwork", "the target network name, ie: fuji, or mumbai, etc (from hardhat.config.js)")
    .addOptionalParam("n", "number of tx", 1, types.int)

//
task("omniCounterIncrementMulti", "increment the destination OmniCounter",
    require("./omniCounterIncrementMulti"))
    .addParam("targetNetworks", "target network names, separated by comma (no spaces)")

//
task("omniCounterSetRemote", "setRemote(chainId, remoteAddr) to allow the local contract to receive messages from known remote contracts",
    require("./omniCounterSetRemote"))
    .addParam("targetNetwork", "the target network to let this instance receive messages from")

//
task("omniCounterPoll", "poll the counter of the OmniCounter",
    require("./omniCounterPoll"))

task("gasIntenseLzReceiveRemoteDeploy", "deploy a large contract (an OmniCounter) on the destination",
    require("./gasIntenseLzReceiveRemoteDeploy"))
    .addParam("targetNetwork", "the target network name, ie: fuji, or mumbai, etc (from hardhat.config.js)")
    .addParam("gas", "quantity of gas for the destination")

task("multiChainTokenSetRemote", "setRemote() so the local contract can receive messages from the remote",
    require("./multiChainTokenSetRemote"))
    .addParam("targetNetwork", "the target network to let this instance receive messages from")

task("multiChainTokenSend", "send tokens to a another chain (to your own address)",
    require("./multiChainTokenSend"))
    .addParam("targetNetwork", "the target network name, ie: fuji, or mumbai, etc (from hardhat.config.js)")
    .addParam("qty", "quantity of tokens")
