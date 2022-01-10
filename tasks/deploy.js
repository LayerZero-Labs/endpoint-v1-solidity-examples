
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

// task("sendMultiChainTokens", "sends MultiChainTokens to destination chain")
//     .addParam("src", "the address of the local MultiChainToken contract address")
//     .addParam("chainId", "the destination chainId")
//     .addParam("dst", "the destination MultiChainToken contract address")
//     .addParam("qty", "the quantity of tokens to send to the destination chain")
//
//     .setAction(async (taskArgs) => {
//
//             console.log(taskArgs);
//             let MultiChainToken = await ethers.getContractFactory('MultiChainToken');
//             let multiChainToken = await MultiChainToken.attach(taskArgs.src);
//             console.log(`multiChainToken.address: ${multiChainToken.address}`);
//
//             // approve
//             let approveTx = await multiChainToken.approve(taskArgs.src, taskArgs.qty);
//             console.log(`approveTx.hash: ${approveTx.hash}`);
//
//             let qty = ethers.BigNumber.from(taskArgs.qty);
//             console.log(`qty: ${qty}`);
//             // sendTokens
//             let tx = await multiChainToken.sendTokens(
//                 taskArgs.chainId,
//                 taskArgs.dst,
//                 qty,
//                 {value: ethers.utils.parseEther('0.003'}
//             );
//             console.log(`tx.hash: ${tx.hash}`);
//
//     });