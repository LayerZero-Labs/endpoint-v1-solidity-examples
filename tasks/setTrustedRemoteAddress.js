const CHAIN_ID = require("../constants/chainIds.json")
const { getDeploymentAddresses } = require("../utils/readStatic")

module.exports = async function (taskArgs, hre) {
    // get local contract name
    let localContract = taskArgs.localContract;

    // get remote contract name
    let remoteContract = taskArgs.remoteContract;

    // get deployed remote contract address
    const remoteAddress = getDeploymentAddresses(taskArgs.targetNetwork)[remoteContract]

    // get remote chain id
    const remoteChainId = CHAIN_ID[taskArgs.targetNetwork]

    // get local contract
    const contractInstance = await ethers.getContract(localContract)
    console.log(`[local] contract address: ${contractInstance.address}`)

    // set pathway
    let remoteLocalPathway = await ethers.utils.solidityPack(['address','address'],[remoteAddress, contractInstance.address])

    // check if pathway is already set
    const isTrustedRemoteSet = await contractInstance.isTrustedRemote(remoteChainId, remoteLocalPathway);

    if(!isTrustedRemoteSet) {
        try {
            let tx = await (await contractInstance.setTrustedRemoteAddress(remoteChainId, remoteAddress)).wait()
            console.log(`✅ [${hre.network.name}] setTrustedRemoteAddress(${remoteChainId}, ${remoteAddress})`)
            console.log(` tx: ${tx.transactionHash}`)
        } catch (e) {
            if (e.error.message.includes("The chainId + address is already trusted")) {
                console.log("*source already set*")
            } else {
                console.log(`❌ [${hre.network.name}] setTrustedRemoteAddress(${remoteChainId}, ${remoteAddress})`)
            }
        }
    } else {
        console.log("*source already set*")
    }
}
