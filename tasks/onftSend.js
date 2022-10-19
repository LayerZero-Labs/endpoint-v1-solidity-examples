const CHAIN_ID = require("../constants/chainIds.json")

module.exports = async function (taskArgs, hre) {
    const signers = await ethers.getSigners()
    const owner = signers[0]
    const toAddress = owner.address;
    const tokenId = taskArgs.tokenId

    let localContract, remoteContract;

    if(taskArgs.contract) {
        localContract = taskArgs.contract;
        remoteContract = taskArgs.contract;
    } else {
        localContract = taskArgs.localContract;
        remoteContract = taskArgs.remoteContract;
    }

    if(!localContract || !remoteContract) {
        console.log("Must pass in contract name OR pass in both localContract name and remoteContract name")
        return
    }

    // get remote chain id
    const remoteChainId = CHAIN_ID[taskArgs.targetNetwork]

    // get local contract
    const localContractInstance = await ethers.getContract(localContract)

    // quote fee with default adapterParams
    let adapterParams = ethers.utils.solidityPack(["uint16", "uint256"], [1, 200000]) // default adapterParams example

    let fees = await localContractInstance.estimateSendFee(remoteChainId, toAddress, tokenId, false, adapterParams)
    console.log(`fees[0] (wei): ${fees[0]} / (eth): ${ethers.utils.formatEther(fees[0])}`)

    try {
        let tx = await (
            await localContractInstance.sendFrom(
                owner.address,                  // 'from' address to send tokens
                remoteChainId,                  // remote LayerZero chainId
                toAddress,                      // 'to' address to send tokens
                tokenId,                        // tokenId to send
                owner.address,                  // refund address (if too much message fee is sent, it gets refunded)
                ethers.constants.AddressZero,   // address(0x0) if not paying in ZRO (LayerZero Token)
                "0x",                           // flexible bytes array to indicate messaging adapter services
                { value: fees[0] }
            )
        ).wait()
        console.log(`✅ [${hre.network.name}] send(${remoteChainId}, ${tokenId})`)
        console.log(` tx: ${tx.transactionHash}`)
    } catch (e) {
        if (e.error?.message.includes("Message sender must own the OmnichainNFT.")) {
            console.log("*Message sender must own the OmnichainNFT.*")
        } else if (e.error.message.includes("This chain is not a trusted source source.")) {
            console.log("*This chain is not a trusted source source.*")
        } else {
            console.log(e)
        }
    }
}

// npx hardhat --network fuji ownerOf --token-id 1 --contract ExampleUniversalONFT721
// npx hardhat --network fuji ownerOf --token-id 11 --contract ExampleUniversalONFT721
// npx hardhat --network bsc-testnet ownerOf --token-id 1 --contract ExampleUniversalONFT721
// npx hardhat --network bsc-testnet ownerOf --token-id 11 --contract ExampleUniversalONFT721

// npx hardhat --network bsc-testnet setTrustedRemote --target-network fuji --contract ExampleUniversalONFT721


// npx hardhat --network bsc-testnet setTrustedRemote --target-network fuji --contract OmniCounter
// npx hardhat --network fuji setTrustedRemote --target-network bsc-testnet --contract OmniCounter

// npx hardhat --network bsc-testnet ocIncrementCounter --target-network fuji
