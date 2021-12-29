
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