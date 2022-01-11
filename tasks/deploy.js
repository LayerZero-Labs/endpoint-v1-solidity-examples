// for example purposes
task("deploy", "deploy an instance of MultiChainCounter.sol")
    .addParam("endpoint", "LayerZero Communicator.sol instance, what we call the 'endpoint'")
    .setAction(async (taskArgs) => {

        let signers = await ethers.getSigners();
        let owner = signers[0];
        console.log(`owner.address: ${owner.address}`);

        //--------------- DocsCounterMock -----------------------------------------------
        const MultiChainCounter = await ethers.getContractFactory("MultiChainCounter");
        const multiChainCounter = await MultiChainCounter.deploy(taskArgs.endpoint);
        await multiChainCounter.deployed();
        console.log("multiChainCounter.address:", multiChainCounter.address);
    });

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